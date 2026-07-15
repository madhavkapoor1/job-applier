/**
 * Multi-profile support: several people (or several distinct searches) can
 * share one install without mixing data. Each profile is a directory under
 * data/profiles/<slug>/ holding that person's config.json, db.json,
 * applications/ and uploaded resume.pdf.
 *
 * The active profile is a pointer file (data/active-profile.json) honoured by
 * both the web UI and the CLI, so they always operate on the same person.
 * A single CLI run can override it with `--profile <name>` (or the
 * JOB_APPLIER_PROFILE env var) without touching the pointer.
 *
 * API keys in .env are intentionally NOT per-profile — they belong to the
 * install (one Reed key serves everyone on this computer).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { writeFileAtomic } from "./fsatomic.ts";

// Anchor to the working dir (project root) so paths resolve correctly both
// under tsx (CLI) and inside Next's server bundle, where import.meta.dirname
// is unreliable.
export const ROOT = process.cwd();
export const DATA_ROOT = resolve(ROOT, "data");
const PROFILES_DIR = resolve(DATA_ROOT, "profiles");
const ACTIVE_PATH = resolve(DATA_ROOT, "active-profile.json");
const DEFAULT_SLUG = "default";

export interface ProfileInfo {
  slug: string;
  /** Person's name once they've saved a profile; prettified slug until then. */
  label: string;
}

/** Directory names must stay path-safe: lowercase alphanumerics and dashes only. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "profile";
}

function moveIfPresent(from: string, to: string): void {
  // Never overwrite an existing destination — if both exist, the legacy copy
  // is left in place for the user to reconcile rather than silently lost.
  if (existsSync(from) && !existsSync(to)) renameSync(from, to);
}

let ensured = false;

/**
 * Create the profiles layout, migrating the original single-user layout
 * (config at the repo root, db under data/) into profiles/default the first
 * time so existing data carries over untouched.
 */
function ensureLayout(): void {
  if (ensured) return;
  mkdirSync(PROFILES_DIR, { recursive: true });

  const legacyConfig = resolve(ROOT, "job-applier.config.json");
  const legacyDb = resolve(DATA_ROOT, "db.json");
  if (existsSync(legacyConfig) || existsSync(legacyDb)) {
    const def = resolve(PROFILES_DIR, DEFAULT_SLUG);
    mkdirSync(def, { recursive: true });
    moveIfPresent(legacyConfig, resolve(def, "config.json"));
    moveIfPresent(legacyDb, resolve(def, "db.json"));
    moveIfPresent(resolve(DATA_ROOT, "applications"), resolve(def, "applications"));
    moveIfPresent(resolve(DATA_ROOT, "resume.pdf"), resolve(def, "resume.pdf"));
  }
  ensured = true;
}

export function profileDir(slug: string): string {
  return resolve(PROFILES_DIR, slugify(slug));
}

/** The profile all reads/writes currently target. */
export function activeProfile(): string {
  ensureLayout();
  const override = process.env.JOB_APPLIER_PROFILE?.trim();
  if (override) return slugify(override);
  try {
    const parsed = JSON.parse(readFileSync(ACTIVE_PATH, "utf8")) as { active?: string };
    if (parsed.active && existsSync(profileDir(parsed.active))) return slugify(parsed.active);
  } catch {
    /* missing/corrupt pointer falls through to the default */
  }
  return DEFAULT_SLUG;
}

/** The active profile's directory (config.json, db.json, applications/ live here). */
export function activeProfileDir(): string {
  ensureLayout();
  const dir = profileDir(activeProfile());
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function setActiveProfile(slug: string): void {
  ensureLayout();
  if (!existsSync(profileDir(slug))) throw new Error(`No such profile: ${slug}`);
  writeFileAtomic(ACTIVE_PATH, JSON.stringify({ active: slugify(slug) }, null, 2) + "\n");
}

/** Create a new, empty profile and return its slug. */
export function createProfile(name: string): string {
  ensureLayout();
  const slug = slugify(name);
  const dir = profileDir(slug);
  if (existsSync(resolve(dir, "config.json"))) {
    throw new Error(`A profile named “${name}” already exists.`);
  }
  mkdirSync(dir, { recursive: true });
  return slug;
}

export function listProfiles(): ProfileInfo[] {
  ensureLayout();
  const dirs = readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (!dirs.length) dirs.push(DEFAULT_SLUG);
  return dirs.map((slug) => ({ slug, label: labelFor(slug) }));
}

function labelFor(slug: string): string {
  try {
    const raw = readFileSync(resolve(profileDir(slug), "config.json"), "utf8");
    const name = (JSON.parse(raw) as { profile?: { name?: string } }).profile?.name?.trim();
    if (name && name !== "Your Name") return name;
  } catch {
    /* no saved config yet */
  }
  // Prettify the slug: "sister-legal" → "Sister Legal".
  return slug.replace(/-+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * CLI helper: honour `--profile <name>` by mapping it onto the env override.
 * The two tokens are removed from argv so scripts that read positional
 * arguments (like mark.ts) aren't confused by them.
 */
export function applyCliProfileArg(argv: string[] = process.argv): void {
  const i = argv.indexOf("--profile");
  if (i >= 0 && argv[i + 1]) {
    process.env.JOB_APPLIER_PROFILE = argv[i + 1];
    argv.splice(i, 2);
  }
}
