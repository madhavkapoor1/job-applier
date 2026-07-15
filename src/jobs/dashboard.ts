/** Builds the serializable state the web UI renders. Server-only (reads fs). */
import { loadConfig, loadEnv, isPlaceholderProfile, uploadedResumePath, env } from "./config.ts";
import { allJobs, allApplications, getJob, getLastDiscovery } from "./store.ts";
import { readMaterial } from "./materials.ts";
import { withinMaxAge } from "./rank.ts";
import { ALL_SOURCES } from "./sources/index.ts";
import { isDirectSource, isAssistable } from "./source-meta.ts";
import { activeProfile, listProfiles, type ProfileInfo } from "./profiles.ts";
import { envKeyStatus, type ManagedEnvKey } from "./envfile.ts";
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
  /** True when assisted-apply can pre-fill this job's form (known ATS). */
  assistable: boolean;
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

export interface SourceState {
  name: string;
  /** Effective: will this source actually run on the next discovery? */
  enabled: boolean;
  /**
   * What the user asked for in config — this (not `enabled`) is what the
   * profile form must round-trip, or saving with a missing API key would
   * silently write the source off.
   */
  configEnabled: boolean;
  /** True for sources that need an API key from .env. */
  needsKey: boolean;
  /** True when every env key this source needs is present. */
  keyPresent: boolean;
}

export interface DashboardState {
  profile: Profile;
  search: SearchConfig;
  sources: SourceState[];
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
  /** Which managed .env keys have a value (values themselves never leave the server). */
  keys: Record<ManagedEnvKey, boolean>;
  /** Everyone using this install, and whose data is currently active. */
  profiles: ProfileInfo[];
  activeProfile: string;
  lastDiscoveryAt?: string;
  jobs: JobCard[];
  queue: QueueCard[];
}

const JOB_LIST_LIMIT = 60;

/** Env keys each keyed source needs; sources absent here are keyless. */
const SOURCE_KEYS: Record<string, string[]> = {
  reed: ["REED_API_KEY"],
  adzuna: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
  serpapi: ["SERPAPI_KEY"],
  usajobs: ["USAJOBS_API_KEY", "USAJOBS_EMAIL"],
};

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
    assistable: isAssistable(job.url, job.source),
    score: job.score,
    matchedKeywords: job.matchedKeywords,
    postedAt: job.postedAt,
    snippet: job.description.slice(0, 320),
  };
}

export function getDashboardState(): DashboardState {
  loadEnv(); // so key indicators reflect .env on first render
  const config = loadConfig();

  const queuedIds = new Set(allApplications().map((a) => a.jobId));
  const jobs = allJobs()
    .filter((j) => !queuedIds.has(j.id))
    .filter((j) => withinMaxAge(j, config.search.maxAgeDays))
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

  const sources: SourceState[] = ALL_SOURCES.map((s) => {
    const keyVars = SOURCE_KEYS[s.name];
    const keyPresent = keyVars ? keyVars.every((k) => !!env(k)) : true;
    const cfg = (config.sources as Record<string, { enabled?: boolean } | undefined>)[s.name];
    // For keyed sources the config flag is the user's intent regardless of the
    // key; for keyless sources isEnabled() already IS the config intent.
    const configEnabled = keyVars ? cfg?.enabled === true : s.isEnabled(config);
    return {
      name: s.name,
      enabled: s.isEnabled(config),
      configEnabled,
      needsKey: !!keyVars,
      keyPresent,
    };
  });

  return {
    profile: config.profile,
    search: config.search,
    sources,
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
    keys: envKeyStatus(),
    profiles: listProfiles(),
    activeProfile: activeProfile(),
    lastDiscoveryAt: getLastDiscovery(),
    jobs,
    queue,
  };
}
