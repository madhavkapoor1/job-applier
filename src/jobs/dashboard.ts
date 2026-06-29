/** Builds the serializable state the web UI renders. Server-only (reads fs). */
import { loadConfig, loadEnv, isPlaceholderProfile, uploadedResumePath, env } from "./config.ts";
import { allJobs, allApplications, getJob, getLastDiscovery } from "./store.ts";
import { readMaterial } from "./materials.ts";
import { ALL_SOURCES } from "./sources/index.ts";
import { isDirectSource } from "./source-meta.ts";
import type { ApplicationStatus, Job, Profile, SearchConfig } from "./types.ts";

export interface JobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  source: string;
  /** True when the url is the company's own apply page (not an aggregator). */
  direct: boolean;
  score: number;
  matchedKeywords: string[];
  postedAt?: string;
  snippet: string;
}

export interface QueueCard extends JobCard {
  status: ApplicationStatus;
  note?: string;
  resume: string;
  coverLetter: string;
}

export interface DashboardState {
  profile: Profile;
  search: SearchConfig;
  sources: { name: string; enabled: boolean }[];
  /** ATS company handles + custom feed URLs currently configured, so the form can round-trip them. */
  sourceCompanies: {
    greenhouse: string[];
    lever: string[];
    ashby: string[];
    workable: string[];
    customFeeds: string[];
  };
  needsSetup: boolean;
  /** True once the user has uploaded their own CV (PDF). */
  hasResume: boolean;
  /** True when an Anthropic API key is configured (enables AI-tailored cover letters). */
  aiEnabled: boolean;
  lastDiscoveryAt?: string;
  jobs: JobCard[];
  queue: QueueCard[];
}

const JOB_LIST_LIMIT = 60;

function toCard(job: Job): JobCard {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    url: job.url,
    source: job.source,
    direct: isDirectSource(job.source),
    score: job.score,
    matchedKeywords: job.matchedKeywords,
    postedAt: job.postedAt,
    snippet: job.description.slice(0, 320),
  };
}

export function getDashboardState(): DashboardState {
  loadEnv(); // so aiEnabled reflects .env on first render
  const config = loadConfig();

  const queuedIds = new Set(allApplications().map((a) => a.jobId));
  const jobs = allJobs()
    .filter((j) => !queuedIds.has(j.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, JOB_LIST_LIMIT)
    .map(toCard);

  const queue: QueueCard[] = [];
  for (const a of allApplications()) {
    if (a.status === "error") continue;
    const job = getJob(a.jobId);
    if (!job) continue;
    // Only queued cards display materials — skip the disk reads for the
    // applied/skipped history, which grows without bound over time.
    const showMaterials = a.status === "queued";
    queue.push({
      ...toCard(job),
      status: a.status,
      note: a.note,
      resume: showMaterials ? readMaterial(a.resumePath) : "",
      coverLetter: showMaterials ? readMaterial(a.coverLetterPath) : "",
    });
  }
  queue.sort((a, b) => b.score - a.score);

  return {
    profile: config.profile,
    search: config.search,
    sources: ALL_SOURCES.map((s) => ({ name: s.name, enabled: s.isEnabled(config) })),
    sourceCompanies: {
      greenhouse: config.sources.greenhouse?.companies ?? [],
      lever: config.sources.lever?.companies ?? [],
      ashby: config.sources.ashby?.companies ?? [],
      workable: config.sources.workable?.companies ?? [],
      customFeeds: config.sources.customfeeds?.urls ?? [],
    },
    needsSetup: isPlaceholderProfile(config),
    hasResume: !!uploadedResumePath(),
    aiEnabled: !!env("ANTHROPIC_API_KEY"),
    lastDiscoveryAt: getLastDiscovery(),
    jobs,
    queue,
  };
}
