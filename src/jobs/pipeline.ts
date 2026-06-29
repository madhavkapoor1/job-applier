/** Shared discovery + queueing logic used by both the CLI scripts and the web UI. */
import { ALL_SOURCES } from "./sources/index.ts";
import { finalize, dedupe } from "./normalize.ts";
import { scoreJob, passesFilters } from "./rank.ts";
import { upsertJobs, saveApplication, saveApplications, setLastDiscovery } from "./store.ts";
import { generateMaterials } from "./materials.ts";
import type { AppConfig, Application, Job } from "./types.ts";

export interface DiscoverySummary {
  enabled: string[];
  skipped: string[];
  /** postings per source; -1 marks a source that errored out. */
  perSource: Record<string, number>;
  fetched: number;
  unique: number;
  kept: number;
  added: number;
  updated: number;
}

/** Fan out across enabled sources, normalize, dedupe, score, filter, and persist. */
export async function runDiscovery(
  config: AppConfig,
): Promise<{ summary: DiscoverySummary; jobs: Job[] }> {
  const now = new Date().toISOString();
  const enabled = ALL_SOURCES.filter((s) => s.isEnabled(config));
  const skipped = ALL_SOURCES.filter((s) => !s.isEnabled(config)).map((s) => s.name);
  const perSource: Record<string, number> = {};

  const results = await Promise.allSettled(
    enabled.map(async (s) => {
      const raw = await s.fetch(config);
      perSource[s.name] = raw.length;
      return raw;
    }),
  );

  const rawJobs = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    perSource[enabled[i].name] = -1;
    return [];
  });

  const jobs: Job[] = dedupe(rawJobs.map((r) => finalize(r, now))).map((j) => scoreJob(j, config));
  const kept = jobs.filter((j) => passesFilters(j, config)).sort((a, b) => b.score - a.score);
  const { added, updated } = upsertJobs(kept);
  setLastDiscovery(now);

  return {
    summary: {
      enabled: enabled.map((s) => s.name),
      skipped,
      perSource,
      fetched: rawJobs.length,
      unique: jobs.length,
      kept: kept.length,
      added,
      updated,
    },
    jobs: kept,
  };
}

/** Generate tailored materials for a job and add it to the review queue. */
export function queueJob(job: Job, config: AppConfig): Application {
  const now = new Date().toISOString();
  const mats = generateMaterials(job, config.profile);
  const app: Application = {
    jobId: job.id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    resumePath: mats.resumePath,
    coverLetterPath: mats.coverLetterPath,
  };
  saveApplication(app);
  return app;
}

export interface QueueResult {
  queued: Application[];
  errors: { jobId: string; title: string; error: string }[];
}

/**
 * Queue many jobs with a single db write. Failures are recorded as
 * status:"error" applications (so they aren't retried forever) and reported.
 * This is the one queueing policy shared by the CLI and the web UI.
 */
export function queueJobs(jobs: Job[], config: AppConfig): QueueResult {
  const now = new Date().toISOString();
  const batch: Application[] = [];
  const result: QueueResult = { queued: [], errors: [] };
  for (const job of jobs) {
    try {
      const mats = generateMaterials(job, config.profile);
      const app: Application = {
        jobId: job.id,
        status: "queued",
        createdAt: now,
        updatedAt: now,
        resumePath: mats.resumePath,
        coverLetterPath: mats.coverLetterPath,
      };
      batch.push(app);
      result.queued.push(app);
    } catch (err) {
      const message = (err as Error).message;
      batch.push({ jobId: job.id, status: "error", createdAt: now, updatedAt: now, note: message });
      result.errors.push({ jobId: job.id, title: job.title, error: message });
    }
  }
  saveApplications(batch);
  return result;
}
