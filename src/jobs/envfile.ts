/**
 * Read/write API keys in the project .env from the web UI, so non-technical
 * users never have to edit a dotfile. Only the keys listed here are managed;
 * every other line in .env is preserved untouched. Keys are install-wide
 * (shared across profiles) by design — one Reed key serves everyone.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, env } from "./config.ts";
import { writeFileAtomic } from "./fsatomic.ts";

export const MANAGED_ENV_KEYS = [
  "REED_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
  "SERPAPI_KEY",
  "ANTHROPIC_API_KEY",
] as const;

export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

const ENV_PATH = resolve(ROOT, ".env");

/** Which managed keys currently have a value (never exposes the values). */
export function envKeyStatus(): Record<ManagedEnvKey, boolean> {
  const status = {} as Record<ManagedEnvKey, boolean>;
  for (const key of MANAGED_ENV_KEYS) status[key] = !!env(key);
  return status;
}

/**
 * Persist the provided keys into .env and process.env (effective immediately,
 * no restart). Blank values are ignored — "leave unchanged", never "clear".
 */
export function saveEnvKeys(updates: Record<string, string>): void {
  const lines = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/)
    : [];

  let changed = false;
  for (const key of MANAGED_ENV_KEYS) {
    const value = updates[key]?.trim();
    if (!value || /[\r\n]/.test(value)) continue;
    const line = `${key}=${value}`;
    const idx = lines.findIndex((l) => l.trimStart().startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
    process.env[key] = value;
    changed = true;
  }
  if (!changed) return;

  writeFileAtomic(ENV_PATH, lines.join("\n").replace(/\n+$/, "") + "\n");
}
