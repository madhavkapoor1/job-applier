import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, activeProfileDir } from "./profiles.ts";
import { writeFileAtomic } from "./fsatomic.ts";
import type { AppConfig } from "./types.ts";

export { ROOT } from "./profiles.ts";
export const TEMPLATE_DIR = resolve(ROOT, "templates");

/**
 * The active profile's data directory (db.json, applications/, resume.pdf).
 * A function, not a constant: it changes when the user switches profiles.
 */
export function dataDir(): string {
  return activeProfileDir();
}

// The user's own uploaded CV (used as-is for applications when present).
export const UPLOADED_RESUME_REL = "resume.pdf"; // relative to dataDir()
export function uploadedResumePath(): string | undefined {
  const p = resolve(dataDir(), UPLOADED_RESUME_REL);
  return existsSync(p) ? p : undefined;
}

// Each profile's live config holds that person's data and is gitignored (the
// whole data/ tree is); the committed example file serves as the template
// until they save a profile.
const EXAMPLE_PATH = resolve(ROOT, "job-applier.config.example.json");

function configPath(): string {
  return resolve(dataDir(), "config.json");
}

/** Load .env into process.env if present (Node 21.7+ native loader). */
export function loadEnv(): void {
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // malformed .env shouldn't crash discovery
    }
  }
}

// Cache keyed by resolved path + mtime, so a profile switch or an edit from
// the other process (CLI vs. web server) is picked up on the next load.
let cached: { path: string; mtimeMs: number; config: AppConfig } | undefined;

/** True once the user has saved their own config (vs. running on the example). */
export function hasUserConfig(): boolean {
  return existsSync(configPath());
}

export function loadConfig(): AppConfig {
  const own = configPath();
  const path = existsSync(own) ? own : EXAMPLE_PATH;
  if (!existsSync(path)) {
    throw new Error(`No config found. Expected ${own} or the committed ${EXAMPLE_PATH}.`);
  }
  const mtimeMs = statSync(path).mtimeMs;
  if (cached && cached.path === path && cached.mtimeMs === mtimeMs) return cached.config;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as AppConfig;
  validate(parsed);
  cached = { path, mtimeMs, config: parsed };
  return parsed;
}

/** Drop the in-process cache so the next loadConfig() re-reads from disk. */
export function resetConfigCache(): void {
  cached = undefined;
}

/** True when setup hasn't happened: no saved user config, or template placeholders remain. */
export function isPlaceholderProfile(c: AppConfig): boolean {
  return (
    !hasUserConfig() ||
    c.profile.name === "Your Name" ||
    c.profile.email === "you@example.com"
  );
}

/** Validate and persist config to disk, updating the cache. */
export function saveConfig(config: AppConfig): void {
  validate(config);
  const path = configPath();
  writeFileAtomic(path, JSON.stringify(config, null, 2));
  cached = { path, mtimeMs: statSync(path).mtimeMs, config };
}

function validate(c: AppConfig): void {
  if (!c.profile?.name || !c.profile?.email) {
    throw new Error("config.profile.name and config.profile.email are required.");
  }
  if (!Array.isArray(c.search?.keywords) || c.search.keywords.length === 0) {
    throw new Error("config.search.keywords must be a non-empty array.");
  }
  c.search.minScore ??= 0;
  c.search.locations ??= [];
  c.search.regions ??= [];
  c.search.remoteOnly ??= false;
  // Only surface jobs posted within this many days; 0 = no limit.
  c.search.maxAgeDays ??= 14;
  c.sources ??= {};
}

/** Read an env var, returning undefined for empty strings. */
export function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}
