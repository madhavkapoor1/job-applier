"use server";

import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadConfig,
  loadEnv,
  saveConfig,
  resetConfigCache,
  isPlaceholderProfile,
  DATA_DIR,
  UPLOADED_RESUME_REL,
  uploadedResumePath,
} from "../jobs/config.ts";
import { runDiscovery, queueJob, queueJobs, type DiscoverySummary } from "../jobs/pipeline.ts";
import {
  getJob,
  setStatus,
  getLastDiscovery,
  allJobs,
  allApplications,
  getApplication,
} from "../jobs/store.ts";
import { generateMaterials } from "../jobs/materials.ts";
import { ensureApplicationPdfs } from "../jobs/pdf.ts";
import { assistedApply } from "../jobs/apply-assist.ts";
import { getDashboardState, type DashboardState } from "../jobs/dashboard.ts";
import type {
  AppConfig,
  ApplicationStatus,
  EducationEntry,
  ExperienceEntry,
  Profile,
} from "../jobs/types.ts";

/** Shape the profile form sends back. Mirrors the editable parts of AppConfig. */
export interface ProfilePayload {
  profile: Profile;
  search: {
    keywords: string[];
    regions: string[];
    locations: string[];
    remoteOnly: boolean;
    minScore: number;
    excludeTitleKeywords: string[];
  };
  sources: {
    reed: boolean;
    themuse: boolean;
    adzuna: boolean;
    serpapi: boolean;
    greenhouse: string[];
    lever: string[];
    ashby: string[];
    workable: string[];
    remotive: boolean;
    remoteok: boolean;
    arbeitnow: boolean;
    jobicy: boolean;
    himalayas: boolean;
    hackernews: boolean;
    usajobs: boolean;
  };
}

export async function getStateAction(): Promise<DashboardState> {
  resetConfigCache();
  return getDashboardState();
}

export async function discoverAction(): Promise<{
  summary: DiscoverySummary;
  state: DashboardState;
}> {
  loadEnv();
  resetConfigCache();
  const config = loadConfig();
  const { summary } = await discoverShared(config);
  return { summary, state: getDashboardState() };
}

// Auto-check on app open: only actually searches if we haven't in a few hours,
// so opening/reloading the app is instant when results are already fresh.
const STALE_MS = 3 * 60 * 60 * 1000;

// Keep this many ready-to-send applications waiting in the review queue.
const QUEUE_TARGET = 15;

/**
 * Auto-prepare: top the review queue back up to QUEUE_TARGET by generating
 * tailored materials for the next-best un-handled jobs (one db write via
 * queueJobs). No-op until a real profile is saved, so we never write
 * materials with placeholder details.
 */
function topUpQueue(config: AppConfig): void {
  if (isPlaceholderProfile(config)) return;
  const queued = allApplications().filter((a) => a.status === "queued").length;
  const need = QUEUE_TARGET - queued;
  if (need <= 0) return;
  const candidates = allJobs()
    .filter((j) => !getApplication(j.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, need);
  const { errors } = queueJobs(candidates, config);
  for (const e of errors) console.warn(`  [auto-prepare] ${e.title}: ${e.error}`);
}

// Share one in-flight discovery across concurrent callers (two tabs, dev
// StrictMode remounts) instead of fetching every source twice in parallel.
let discovering: Promise<{ summary: DiscoverySummary }> | null = null;

function discoverShared(config: AppConfig): Promise<{ summary: DiscoverySummary }> {
  if (!discovering) {
    discovering = runDiscovery(config).finally(() => {
      discovering = null;
    });
  }
  return discovering;
}

export async function ensureFreshAction(): Promise<{
  ran: boolean;
  summary?: DiscoverySummary;
  state: DashboardState;
}> {
  resetConfigCache();
  const config = loadConfig();
  const last = getLastDiscovery();
  const stale = !last || Date.now() - Date.parse(last) > STALE_MS;

  let summary: DiscoverySummary | undefined;
  if (stale) {
    loadEnv();
    ({ summary } = await discoverShared(config));
  }
  topUpQueue(config); // auto-prepare ready-to-send applications
  return { ran: stale, summary, state: getDashboardState() };
}

export async function queueAction(jobId: string): Promise<DashboardState> {
  const config = loadConfig();
  const job = getJob(jobId);
  if (job) queueJob(job, config);
  return getDashboardState();
}

export async function markAction(
  jobId: string,
  status: ApplicationStatus,
  note?: string,
): Promise<DashboardState> {
  setStatus(jobId, status, note);
  return getDashboardState();
}

/** Save the uploaded CV (PDF) so applications use the real resume as-is. */
export async function uploadResumeAction(
  formData: FormData,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    const file = formData.get("resume");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file received." };
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { ok: false, error: "Please upload a PDF file." };
    }
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10 MB)." };
    mkdirSync(DATA_DIR, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    writeFileSync(resolve(DATA_DIR, UPLOADED_RESUME_REL), buf);
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeResumeAction(): Promise<DashboardState> {
  try {
    rmSync(resolve(DATA_DIR, UPLOADED_RESUME_REL), { force: true });
  } catch {
    /* already gone */
  }
  return getDashboardState();
}

/**
 * Open the job's application form in a visible browser with the user's details + CV
 * pre-filled. The user answers any custom questions, passes the CAPTCHA, and submits.
 * Prefers the uploaded CV; otherwise generates a PDF from the tailored template.
 */
export async function assistApplyAction(
  jobId: string,
): Promise<{ ok: true; filled: string[] } | { ok: false; error: string }> {
  try {
    loadEnv();
    resetConfigCache();
    const config = loadConfig();
    const job = getJob(jobId);
    if (!job) return { ok: false, error: "Job not found." };

    // Ensure materials exist (for the cover letter + generated-CV fallback).
    let app = getApplication(jobId);
    if (!app) {
      queueJob(job, config);
      app = getApplication(jobId);
    }

    // CV source: the uploaded PDF wins; otherwise render the generated resume.
    let resumeAbs = uploadedResumePath();
    const pdfs = await ensureApplicationPdfs(app?.resumePath, app?.coverLetterPath);
    if (!resumeAbs && pdfs.resumePdf) resumeAbs = resolve(DATA_DIR, pdfs.resumePdf);
    const coverAbs = pdfs.coverPdf ? resolve(DATA_DIR, pdfs.coverPdf) : undefined;

    const { filled } = await assistedApply(job, config.profile, resumeAbs, coverAbs);
    return { ok: true, filled };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function saveProfileAction(
  payload: ProfilePayload,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    resetConfigCache();
    const current = loadConfig();
    const next = mergeConfig(current, payload);
    saveConfig(next); // validates name/email/keywords
    topUpQueue(next); // now that the profile is real, prepare ready-to-send applications
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function cleanList(arr: unknown): string[] {
  return Array.isArray(arr)
    ? arr.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];
}

function mergeConfig(current: AppConfig, p: ProfilePayload): AppConfig {
  // Keep only links the user actually filled in — empty values would otherwise
  // render as "github:  |" garbage in generated materials.
  const links = Object.fromEntries(
    Object.entries(p.profile.links ?? {})
      .map(([k, v]): [string, string] => [k, String(v ?? "").trim()])
      .filter(([, v]) => v),
  );

  const profile: Profile = {
    name: p.profile.name?.trim() ?? "",
    email: p.profile.email?.trim() ?? "",
    phone: p.profile.phone?.trim() || undefined,
    location: p.profile.location?.trim() || undefined,
    links: Object.keys(links).length ? links : undefined,
    summary: p.profile.summary?.trim() ?? "",
    skills: cleanList(p.profile.skills),
    experience: (p.profile.experience ?? []).map(
      (e): ExperienceEntry => ({
        title: e.title?.trim() ?? "",
        company: e.company?.trim() ?? "",
        start: e.start?.trim() ?? "",
        end: e.end?.trim() ?? "",
        bullets: cleanList(e.bullets),
      }),
    ),
    education: (p.profile.education ?? []).map(
      (e): EducationEntry => ({
        degree: e.degree?.trim() ?? "",
        school: e.school?.trim() ?? "",
        year: e.year?.trim() ?? "",
      }),
    ),
  };

  return {
    profile,
    search: {
      keywords: cleanList(p.search.keywords),
      regions: cleanList(p.search.regions),
      locations: cleanList(p.search.locations),
      remoteOnly: !!p.search.remoteOnly,
      minScore: Number(p.search.minScore) || 0,
      excludeTitleKeywords: cleanList(p.search.excludeTitleKeywords),
    },
    sources: {
      reed: { enabled: !!p.sources.reed },
      themuse: {
        enabled: !!p.sources.themuse,
        category: current.sources.themuse?.category,
      },
      greenhouse: { companies: cleanList(p.sources.greenhouse) },
      lever: { companies: cleanList(p.sources.lever) },
      ashby: { companies: cleanList(p.sources.ashby) },
      workable: { companies: cleanList(p.sources.workable) },
      remotive: { enabled: !!p.sources.remotive },
      remoteok: { enabled: !!p.sources.remoteok },
      arbeitnow: { enabled: !!p.sources.arbeitnow },
      jobicy: { enabled: !!p.sources.jobicy },
      himalayas: { enabled: !!p.sources.himalayas },
      hackernews: {
        enabled: !!p.sources.hackernews,
        monthsBack: current.sources.hackernews?.monthsBack ?? 1,
      },
      adzuna: { enabled: !!p.sources.adzuna, country: current.sources.adzuna?.country ?? "gb" },
      usajobs: { enabled: !!p.sources.usajobs },
      serpapi: {
        enabled: !!p.sources.serpapi,
        location: current.sources.serpapi?.location ?? "United Kingdom",
      },
    },
  };
}
