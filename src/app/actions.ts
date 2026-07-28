"use server";

import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadConfig,
  loadEnv,
  saveConfig,
  resetConfigCache,
  dataDir,
  UPLOADED_RESUME_REL,
  uploadedResumePath,
} from "../jobs/config.ts";
import { runDiscovery, queueJob, type DiscoverySummary } from "../jobs/pipeline.ts";
import {
  getJob,
  setStatus,
  getLastDiscovery,
  allApplications,
  getApplication,
} from "../jobs/store.ts";
import { ensureApplicationPdfs } from "../jobs/pdf.ts";
import { assistedApply, assistedApplyBatch, type BatchApplyItem } from "../jobs/apply-assist.ts";
import { saveEnvKeys } from "../jobs/envfile.ts";
import { createProfile, setActiveProfile } from "../jobs/profiles.ts";
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
    maxAgeDays: number;
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
    customFeeds: string[];
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
  loadEnv();
  resetConfigCache();
  const config = loadConfig();
  const last = getLastDiscovery();
  const stale = !last || Date.now() - Date.parse(last) > STALE_MS;

  let summary: DiscoverySummary | undefined;
  if (stale) {
    ({ summary } = await discoverShared(config));
  }
  // No auto-prepare: jobs enter the review queue only when the user clicks
  // "Prepare application" (or assisted apply), so nothing is generated behind
  // their back — and no AI cover-letter spend they didn't ask for.
  return { ran: stale, summary, state: getDashboardState() };
}

export async function queueAction(
  jobId: string,
): Promise<{ ok: boolean; error?: string; state: DashboardState }> {
  try {
    loadEnv(); // AI cover letters read ANTHROPIC_API_KEY
    const config = loadConfig();
    const job = getJob(jobId);
    if (job) await queueJob(job, config);
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message, state: getDashboardState() };
  }
}

export async function markAction(
  jobId: string,
  status: ApplicationStatus,
  note?: string,
): Promise<DashboardState> {
  setStatus(jobId, status, note);
  return getDashboardState();
}

/**
 * Save API keys into .env (only non-blank values are written; existing keys
 * are never cleared from the UI). Effective immediately — no restart.
 */
export async function saveKeysAction(
  keys: Record<string, string>,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    saveEnvKeys(keys);
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Switch whose profile (config + jobs + queue) the app is working with. */
export async function switchProfileAction(
  slug: string,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    // Let an in-flight discovery finish writing to the old profile's db first,
    // so its results don't land in the profile we're switching to.
    await discovering?.catch(() => {});
    setActiveProfile(slug);
    resetConfigCache();
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Create a new person's profile and switch to it. */
export async function createProfileAction(
  name: string,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    if (!name.trim()) return { ok: false, error: "Give the profile a name." };
    await discovering?.catch(() => {});
    const slug = createProfile(name.trim());
    setActiveProfile(slug);
    resetConfigCache();
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
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
    mkdirSync(dataDir(), { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    writeFileSync(resolve(dataDir(), UPLOADED_RESUME_REL), buf);
    return { ok: true, state: getDashboardState() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeResumeAction(): Promise<DashboardState> {
  try {
    rmSync(resolve(dataDir(), UPLOADED_RESUME_REL), { force: true });
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
      await queueJob(job, config);
      app = getApplication(jobId);
    }

    // CV source: the uploaded PDF wins; otherwise render the generated resume.
    let resumeAbs = uploadedResumePath();
    const pdfs = await ensureApplicationPdfs(app?.resumePath, app?.coverLetterPath);
    if (!resumeAbs && pdfs.resumePdf) resumeAbs = resolve(dataDir(), pdfs.resumePdf);
    const coverAbs = pdfs.coverPdf ? resolve(dataDir(), pdfs.coverPdf) : undefined;

    const { filled } = await assistedApply(job, config.profile, resumeAbs, coverAbs);
    return { ok: true, filled };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// How many jobs a single "apply to all" batch opens at once, so the window
// stays manageable and we don't hammer sites. The rest wait for the next click.
const BATCH_APPLY_LIMIT = 8;

/**
 * Open every ready application whose form we can pre-fill in one browser window
 * (each in its own tab, pre-filled), so the user can tab through and submit them
 * quickly. Returns how many opened, how many were skipped (unrecognised form),
 * and how many remain for a follow-up click.
 */
export async function assistApplyAllAction(): Promise<
  | { ok: true; opened: number; skipped: number; remaining: number; details: { title: string; filled: string[] }[] }
  | { ok: false; error: string }
> {
  try {
    loadEnv();
    resetConfigCache();
    const config = loadConfig();

    // Only queued (ready) applications whose job form is a known ATS we can fill.
    const ready = allApplications()
      .filter((a) => a.status === "queued")
      .map((a) => getJob(a.jobId))
      .filter((j): j is NonNullable<typeof j> => !!j)
      .sort((a, b) => b.score - a.score);

    const { atsFromUrl } = await import("../jobs/source-meta.ts");
    const assistable = ready.filter((j) => atsFromUrl(j.url));
    const skipped = ready.length - assistable.length;
    const take = assistable.slice(0, BATCH_APPLY_LIMIT);
    if (!take.length) {
      return { ok: true, opened: 0, skipped, remaining: 0, details: [] };
    }

    const items: BatchApplyItem[] = [];
    for (const job of take) {
      const app = getApplication(job.id);
      let resumeAbs = uploadedResumePath();
      const pdfs = await ensureApplicationPdfs(app?.resumePath, app?.coverLetterPath);
      if (!resumeAbs && pdfs.resumePdf) resumeAbs = resolve(dataDir(), pdfs.resumePdf);
      const coverAbs = pdfs.coverPdf ? resolve(dataDir(), pdfs.coverPdf) : undefined;
      items.push({ job, resumeAbs, coverAbs });
    }

    const results = await assistedApplyBatch(items, config.profile);
    const opened = results.filter((r) => r.ok).length;
    return {
      ok: true,
      opened,
      skipped,
      remaining: Math.max(0, assistable.length - take.length),
      details: results.filter((r) => r.ok).map((r) => ({ title: r.title, filled: r.filled })),
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function saveProfileAction(
  payload: ProfilePayload,
): Promise<{ ok: true; state: DashboardState } | { ok: false; error: string }> {
  try {
    loadEnv();
    resetConfigCache();
    const current = loadConfig();
    const next = mergeConfig(current, payload);
    saveConfig(next); // validates name/email/keywords
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
    experience: (p.profile.experience ?? [])
      .map(
        (e): ExperienceEntry => ({
          title: e.title?.trim() ?? "",
          company: e.company?.trim() ?? "",
          start: e.start?.trim() ?? "",
          end: e.end?.trim() ?? "",
          bullets: cleanList(e.bullets),
        }),
      )
      // Drop all-empty rows (the form always renders one blank row).
      .filter((e) => e.title || e.company || e.bullets.length),
    education: (p.profile.education ?? [])
      .map(
        (e): EducationEntry => ({
          degree: e.degree?.trim() ?? "",
          school: e.school?.trim() ?? "",
          year: e.year?.trim() ?? "",
        }),
      )
      .filter((e) => e.degree || e.school),
  };

  const maxAgeDaysRaw = Number(p.search.maxAgeDays);
  const maxAgeDays =
    Number.isFinite(maxAgeDaysRaw) && maxAgeDaysRaw >= 0 ? Math.round(maxAgeDaysRaw) : 14;

  return {
    profile,
    search: {
      keywords: cleanList(p.search.keywords),
      regions: cleanList(p.search.regions),
      locations: cleanList(p.search.locations),
      remoteOnly: !!p.search.remoteOnly,
      minScore: Number(p.search.minScore) || 0,
      maxAgeDays,
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
      customfeeds: { urls: cleanList(p.sources.customFeeds) },
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
