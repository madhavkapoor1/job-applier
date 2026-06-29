import { locationInRegions } from "./regions.ts";
import { isDirectSource } from "./source-meta.ts";
import type { AppConfig, Job } from "./types.ts";

/**
 * Whole-word(ish) match: the term must be bounded by non-alphanumerics (or
 * string ends), so short skills like "C", "Go", "AI", "RF" don't match inside
 * unrelated words ("email", "category", "performance"). Case-insensitive.
 */
function wordMatch(haystack: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(haystack);
}

/**
 * Score a job 0..100 on fit, and record which keywords matched.
 * Heuristic (no AI): keyword/skill hits in title (heavy) + description.
 *
 * Location/remote/freshness bonuses are only awarded to jobs that are
 * topically relevant (a search term in the title, or 2+ term matches).
 * That keeps eligibility in ONE knob — minScore — instead of letting a
 * job in the right city pass the filter on location points alone.
 */
export function scoreJob(job: Job, config: AppConfig): Job {
  const { search, profile } = config;
  const title = job.title.toLowerCase();
  const desc = job.description.toLowerCase();

  const terms = unique([
    ...search.keywords.map((k) => k.toLowerCase()),
    ...profile.skills.map((s) => s.toLowerCase()),
  ]);

  const matched = new Set<string>();
  let titleHit = false;
  let points = 0;
  for (const term of terms) {
    if (!term) continue;
    if (wordMatch(title, term)) {
      points += 12;
      titleHit = true;
      matched.add(term);
    } else if (wordMatch(desc, term)) {
      points += 4;
      matched.add(term);
    }
  }

  // Relevance: on-topic means a title hit, or at least two term matches —
  // a single boilerplate mention (e.g. "compliance" once in a footer) isn't enough.
  const relevant = titleHit || matched.size >= 2;

  if (relevant) {
    // Location / remote alignment. Remote scores on its own; an in-region or
    // configured-city posting earns a +10 bonus. This is only a ranking nudge —
    // "country + remote/global" semantics mean no location HARD filter, so a
    // global/remote role with a blank location still ranks on keyword fit.
    if (job.remote) points += search.remoteOnly ? 15 : 8;
    const loc = job.location.toLowerCase();
    const cityHit = search.locations.some((l) => l && loc.includes(l.toLowerCase()));
    const regionHit = locationInRegions(job.location, search.regions);
    if (cityHit || regionHit) points += 10;

    // Freshness: postings from the last 14 days get a small nudge.
    if (job.postedAt) {
      const ageDays = (Date.now() - Date.parse(job.postedAt)) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays <= 14) points += 6;
    }

    // Direct-apply preference: jobs that land on the company's own application
    // page (ATS / careers site / Google Jobs) rank above aggregator listings.
    if (isDirectSource(job.source)) points += 10;
  }

  job.score = Math.min(100, Math.round(points));
  job.matchedKeywords = [...matched];
  return job;
}

/** Apply hard filters (usable url, remote-only, excluded titles, on-topic title, min score). */
export function passesFilters(job: Job, config: AppConfig): boolean {
  const { search } = config;
  if (!job.url) return false; // nothing to apply to
  if (search.remoteOnly && !job.remote) return false;

  const title = job.title;
  if (search.excludeTitleKeywords?.length) {
    if (search.excludeTitleKeywords.some((k) => wordMatch(title, k))) return false;
  }

  // Eligibility = the ROLE itself is on-topic: its title must contain a search
  // keyword. This is what separates "the right kind of job" from a fintech eng
  // role that merely mentions "compliance" in its description boilerplate.
  // (Description/skills/location still drive the score for ranking.)
  if (!search.keywords.some((k) => wordMatch(title, k))) return false;

  return job.score >= (search.minScore ?? 0);
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
