import { fetchJson } from "../http.ts";
import { env } from "../config.ts";
import { parseLocations } from "../locations.ts";
import { googleLocations } from "../regions.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

/**
 * Which Google Jobs `location` string(s) to search, in priority order:
 *   1. Specific cities the user typed — these win, so "Manchester" narrows the
 *      search even when a country/region is also selected. (This was the bug:
 *      a selected region used to make the city be ignored.)
 *   2. Otherwise, one location per selected region.
 *   3. Otherwise, the configured source location, or worldwide.
 * Exported for unit testing (no network).
 */
export function pickGoogleLocations(config: AppConfig): (string | undefined)[] {
  const { cities } = parseLocations(config.search.locations);
  if (cities.length) return cities;
  if (config.search.regions?.length) return googleLocations(config.search.regions);
  return [config.sources.serpapi?.location || undefined];
}

interface SerpJob {
  title: string;
  company_name?: string;
  location?: string;
  description?: string;
  job_id?: string;
  share_link?: string;
  via?: string;
  apply_options?: { title?: string; link?: string }[];
  detected_extensions?: { posted_at?: string; schedule_type?: string; work_from_home?: boolean };
}

/**
 * Google Jobs via SerpAPI (engine=google_jobs). Needs SERPAPI_KEY.
 * This is how we tap "what comes up when you Google a job keyword" without scraping.
 */
export const serpapi: JobSource = {
  name: "serpapi",
  isEnabled: (c) => c.sources.serpapi?.enabled === true && !!env("SERPAPI_KEY"),
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const key = env("SERPAPI_KEY")!;
    // Specific city wins over region; region wins over worldwide. See pickGoogleLocations.
    const locations = pickGoogleLocations(config);

    // keyword × location fan-out. Each combo is one SerpAPI call — mind the
    // free tier (100/mo) when combining many keywords with many regions.
    const queries = config.search.keywords.flatMap((kw) =>
      locations.map((location) => ({ kw, location })),
    );

    const batches = await Promise.all(
      queries.map(async ({ kw, location }): Promise<SerpJob[]> => {
        try {
          const q = encodeURIComponent(kw);
          const loc = location ? `&location=${encodeURIComponent(location)}` : "";
          const data = await fetchJson<{ jobs_results?: SerpJob[] }>(
            `https://serpapi.com/search.json?engine=google_jobs&q=${q}${loc}&api_key=${key}`,
          );
          return data.jobs_results ?? [];
        } catch (err) {
          console.warn(`  [serpapi] "${kw}"${location ? ` @ ${location}` : ""}: ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const j of batches.flat()) {
      const url = j.apply_options?.[0]?.link ?? j.share_link ?? "";
      const dedupeKey = j.job_id ?? url ?? `${j.company_name}|${j.title}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({
        source: "serpapi",
        sourceId: j.job_id,
        title: j.title,
        company: j.company_name ?? j.via ?? "Unknown",
        location: j.location ?? "",
        url,
        description: j.description ?? "",
        employmentType: j.detected_extensions?.schedule_type,
        remote: j.detected_extensions?.work_from_home,
        postedAt: j.detected_extensions?.posted_at,
      });
    }
    return out;
  },
};
