import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "./types.ts";

// Anchor to the working dir (project root) so paths resolve correctly both under
// tsx (CLI) and inside Next's server bundle, where import.meta.dirname is unreliable.
export const ROOT = process.cwd();
export const DATA_DIR = resolve(ROOT, "data");
export const TEMPLATE_DIR = resolve(ROOT, "templates");

// The user's own uploaded CV (used as-is for applications when present).
export const UPLOADED_RESUME_REL = "resume.pdf"; // relative to DATA_DIR
export function uploadedResumePath(): string | undefined {
  const p = resolve(DATA_DIR, UPLOADED_RESUME_REL);
  return existsSync(p) ? p : undefined;
}

// The live config holds the user's personal data and is gitignored; the
// committed example file serves as the template until the user saves a profile.
const CONFIG_PATH = resolve(ROOT, "job-applier.config.json");
const EXAMPLE_PATH = resolve(ROOT, "job-applier.config.example.json");

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

let cached: AppConfig | undefined;

/** True once the user has saved their own config (vs. running on the example). */
export function hasUserConfig(): boolean {
  return existsSync(CONFIG_PATH);
}

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const path = existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH;
  if (!existsSync(path)) {
    throw new Error(
      `No config found. Expected ${CONFIG_PATH} or the committed ${EXAMPLE_PATH}.`,
    );
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as AppConfig;
  validate(parsed);
  cached = parsed;
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
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  cached = config;
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
  c.sources ??= {};
}

/** Read an env var, returning undefined for empty strings. */
export function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}
