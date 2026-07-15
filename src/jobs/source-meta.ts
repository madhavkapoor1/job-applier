/**
 * Which sources land you on the *company's own* application page (an ATS form or
 * the employer's careers site) vs. an aggregator's listing page you then click
 * through. "Direct" jobs are preferred: you apply on the real form, and our
 * assisted-apply can pre-fill it.
 *
 * - greenhouse / lever / ashby / workable — the company's ATS apply page.
 * - serpapi (Google Jobs) — apply links usually point at the company/ATS.
 * - usajobs — the official federal application portal.
 *
 * Aggregators (jobicy, remoteok, arbeitnow, himalayas, remotive, themuse, reed,
 * adzuna) link to their own listing first. `customfeeds` is unknown per-feed, so
 * it's treated as not-direct.
 *
 * Kept dependency-free so rank.ts (and anything else) can import it cheaply.
 */
export const DIRECT_SOURCES: ReadonlySet<string> = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "serpapi",
  "usajobs",
]);

/** True when a source's job url is the company's own apply page (not an aggregator). */
export function isDirectSource(source: string): boolean {
  return DIRECT_SOURCES.has(source);
}

/** Applicant-tracking systems whose forms assisted-apply can pre-fill. */
export const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com"] as const;
export type AtsKind = "greenhouse" | "lever" | "ashby" | "workable";

/** Identify which ATS a url belongs to (by host), or undefined if none. */
export function atsFromUrl(url: string): AtsKind | undefined {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (host.includes("greenhouse.io")) return "greenhouse";
  if (host.includes("lever.co")) return "lever";
  if (host.includes("ashbyhq.com")) return "ashby";
  if (host.includes("workable.com")) return "workable";
  return undefined;
}

/**
 * True when assisted-apply can meaningfully pre-fill this job's form: the url
 * points at a known ATS, or it came from an ATS source. Google Jobs links often
 * resolve to an ATS too, but we only promise assist when the url is recognisable.
 */
export function isAssistable(url: string, source: string): boolean {
  return !!atsFromUrl(url) || (["greenhouse", "lever", "ashby", "workable"] as string[]).includes(source);
}
