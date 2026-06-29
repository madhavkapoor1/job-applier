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
