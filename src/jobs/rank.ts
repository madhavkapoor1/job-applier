import { locationInRegions, includesGlobal } from "./regions.ts";
import { parseLocations } from "./locations.ts";
import { isDirectSource } from "./source-meta.ts";
import type { AppConfig, Job, SearchConfig } from "./types.ts";

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

/**
 * True when the job is recent enough for the configured window (maxAgeDays;
 * 0/unset = no limit). Uses the posting date when the source provides one,
 * otherwise when we first discovered it — so undated jobs still age out.
 */
export function withinMaxAge(job: Job, maxAgeDays: number | undefined, now = Date.now()): boolean {
  if (!maxAgeDays || maxAgeDays <= 0) return true;
  const stamp = Date.parse(job.postedAt ?? "") || Date.parse(job.discoveredAt ?? "");
  if (!Number.isFinite(stamp) || stamp === 0) return true; // no usable date — keep
  return now - stamp <= maxAgeDays * 86_400_000;
}

/**
 * Location gate: when the user has expressed WHERE they want to work (specific
 * cities, or a country region), keep only jobs that actually fit — not every
 * worldwide-remote posting the keyless boards return. Remote roles pass only
 * when the user opts into remote (the "Global/Remote" region, or a remote word
 * in their cities list). With no geographic intent at all, everything passes.
 */
export function matchesLocation(job: Job, search: SearchConfig): boolean {
  const { cities, remote: remoteTyped } = parseLocations(search.locations);
  const regions = search.regions ?? [];
  const placeRegions = regions.filter((r) => r !== "global");
  const hasGeoIntent = cities.length > 0 || placeRegions.length > 0;
  if (!hasGeoIntent) return true; // user hasn't said where — don't constrain

  const loc = (job.location || "").toLowerCase();
  const isRemote = job.remote || /\b(remote|anywhere|work from home|wfh|distributed)\b/i.test(loc);
  const wantsRemote = remoteTyped || includesGlobal(regions);

  if (cities.some((c) => c && loc.includes(c.toLowerCase()))) return true; // in a chosen city
  if (locationInRegions(job.location, placeRegions)) return true; // in a chosen country
  if (isRemote && wantsRemote) return true; // remote, and user is open to remote
  if (!loc.trim() && !isRemote) return true; // location unknown — don't drop on a guess
  return false;
}

/** Apply hard filters (usable url, freshness, remote-only, location, excluded titles, on-topic title, min score). */
export function passesFilters(job: Job, config: AppConfig): boolean {
  const { search } = config;
  if (!job.url) return false; // nothing to apply to
  if (!withinMaxAge(job, search.maxAgeDays)) return false;
  if (search.remoteOnly && !job.remote) return false;
  if (!matchesLocation(job, search)) return false;

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
