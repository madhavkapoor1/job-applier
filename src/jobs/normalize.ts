import { createHash } from "node:crypto";
import type { Job, RawJob } from "./types.ts";

/** Decode HTML entities: named ones boards emit + any numeric/hex entity. */
export function decodeEntities(s: string): string {
  if (!s) return "";
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)));
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

/** Strip HTML tags + decode entities, collapse whitespace. */
export function stripHtml(html: string): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Stable id so the same posting from re-runs (or two sources) dedupes to one row. */
export function jobId(company: string, title: string, location: string): string {
  return createHash("sha1")
    .update(`${norm(company)}|${norm(title)}|${norm(location)}`)
    .digest("hex")
    .slice(0, 16);
}

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere|distributed)\b/i;

function inferRemote(raw: RawJob): boolean {
  if (typeof raw.remote === "boolean") return raw.remote;
  return REMOTE_RE.test(raw.location || "") || REMOTE_RE.test(raw.title || "");
}

/** Turn a source's RawJob into a fully-formed Job (id, remote, timestamps). Score added later. */
export function finalize(raw: RawJob, now: string): Job {
  const company = decodeEntities((raw.company || "Unknown").trim());
  const title = decodeEntities((raw.title || "Untitled").trim());
  const location = decodeEntities((raw.location || "").trim()) || "Unspecified";
  return {
    ...raw,
    id: jobId(company, title, location),
    company,
    title,
    location,
    description: stripHtml(raw.description || ""),
    remote: inferRemote(raw),
    discoveredAt: now,
    score: 0,
    matchedKeywords: [],
  };
}

/** Collapse duplicates by id, preferring the entry with the longer description. */
export function dedupe(jobs: Job[]): Job[] {
  const byId = new Map<string, Job>();
  for (const job of jobs) {
    const existing = byId.get(job.id);
    if (!existing || job.description.length > existing.description.length) {
      byId.set(job.id, job);
    }
  }
  return [...byId.values()];
}
