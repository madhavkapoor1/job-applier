import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "./config.ts";
import type { Application, ApplicationStatus, Job } from "./types.ts";

const DB_PATH = resolve(DATA_DIR, "db.json");

interface DB {
  jobs: Record<string, Job>;
  applications: Record<string, Application>;
  meta?: { lastDiscoveryAt?: string };
}

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

function emptyDb(): DB {
  return { jobs: {}, applications: {} };
}

function fileMtime(): number | undefined {
  try {
    return statSync(DB_PATH).mtimeMs;
  } catch {
    return undefined; // file doesn't exist yet
  }
}

// In-process cache, invalidated whenever db.json changes on disk. The CLI and
// the web server are separate processes writing the same file — without the
// mtime check, one would read stale data and clobber the other's writes.
let db: DB | undefined;
let loadedMtime: number | undefined;

function read(): DB {
  const mtime = fileMtime();
  if (db && mtime === loadedMtime) return db;
  ensureDir();
  if (mtime === undefined) {
    db = emptyDb();
    loadedMtime = undefined;
    return db;
  }
  try {
    db = JSON.parse(readFileSync(DB_PATH, "utf8")) as DB;
    db.jobs ??= {};
    db.applications ??= {};
  } catch {
    db = emptyDb();
  }
  loadedMtime = mtime;
  return db;
}

/** Persist the given DB object (always the one returned by read(), mutated in place). */
function write(d: DB): void {
  ensureDir();
  writeFileSync(DB_PATH, JSON.stringify(d, null, 2));
  db = d;
  loadedMtime = fileMtime();
}

/** Insert/update jobs. Returns counts of new vs. already-seen. */
export function upsertJobs(jobs: Job[]): { added: number; updated: number } {
  const d = read();
  let added = 0;
  let updated = 0;
  for (const job of jobs) {
    if (d.jobs[job.id]) {
      // Preserve original discovery time; refresh score/description.
      const prev = d.jobs[job.id];
      d.jobs[job.id] = { ...job, discoveredAt: prev.discoveredAt };
      updated++;
    } else {
      d.jobs[job.id] = job;
      added++;
    }
  }
  write(d);
  return { added, updated };
}

export function allJobs(): Job[] {
  return Object.values(read().jobs);
}

export function getJob(id: string): Job | undefined {
  return read().jobs[id];
}

export function getApplication(jobId: string): Application | undefined {
  return read().applications[jobId];
}

export function allApplications(): Application[] {
  return Object.values(read().applications);
}

export function saveApplication(app: Application): void {
  const d = read();
  d.applications[app.jobId] = app;
  write(d);
}

/** Save many applications with a single file write. */
export function saveApplications(apps: Application[]): void {
  if (!apps.length) return;
  const d = read();
  for (const app of apps) d.applications[app.jobId] = app;
  write(d);
}

export function getLastDiscovery(): string | undefined {
  return read().meta?.lastDiscoveryAt;
}

export function setLastDiscovery(iso: string): void {
  const d = read();
  d.meta ??= {};
  d.meta.lastDiscoveryAt = iso;
  write(d);
}

export function setStatus(jobId: string, status: ApplicationStatus, note?: string): boolean {
  const d = read();
  const app = d.applications[jobId];
  if (!app) return false;
  app.status = status;
  app.updatedAt = new Date().toISOString();
  if (note !== undefined) app.note = note;
  write(d);
  return true;
}
