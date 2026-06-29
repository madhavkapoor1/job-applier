import { fetchJson } from "../http.ts";
import { env } from "../config.ts";
import { narrowCity } from "../locations.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface ReedResult {
  jobId: number;
  employerName?: string;
  jobTitle: string;
  locationName?: string;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
  jobDescription?: string; // truncated HTML snippet
  jobUrl: string;
  date?: string; // posted date, DD/MM/YYYY
}

/** Reed returns DD/MM/YYYY, which Date.parse can't read — convert to ISO. */
function toIsoDate(d?: string): string | undefined {
  const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

/**
 * Reed.co.uk — the UK's largest job board, strong legal coverage.
 * Free key from https://www.reed.co.uk/developers (Basic auth: key as username, blank password).
 * Keywords are fetched in parallel and deduped by jobId.
 */
export const reed: JobSource = {
  name: "reed",
  isEnabled: (c) => c.sources.reed?.enabled === true && !!env("REED_API_KEY"),
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const key = env("REED_API_KEY")!;
    const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");
    // Narrow to a city only when the config doesn't ask for country-wide results.
    const city = narrowCity(config.search.locations);
    const locationParam = city
      ? `&locationName=${encodeURIComponent(city)}&distanceFromLocation=15`
      : "";

    const batches = await Promise.all(
      config.search.keywords.map(async (kw): Promise<ReedResult[]> => {
        try {
          const data = await fetchJson<{ results?: ReedResult[] }>(
            `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(kw)}` +
              `&resultsToTake=100${locationParam}`,
            { headers: { Authorization: auth } },
          );
          return data.results ?? [];
        } catch (err) {
          console.warn(`  [reed] "${kw}": ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<number>();
    for (const r of batches.flat()) {
      if (seen.has(r.jobId)) continue;
      seen.add(r.jobId);
      out.push({
        source: "reed",
        sourceId: String(r.jobId),
        title: r.jobTitle,
        company: r.employerName ?? "Undisclosed",
        location: r.locationName ?? "",
        url: r.jobUrl,
        description: r.jobDescription ?? "",
        salary:
          r.minimumSalary != null || r.maximumSalary != null
            ? {
                min: r.minimumSalary,
                max: r.maximumSalary,
                currency: r.currency ?? "GBP",
                period: "year",
              }
            : undefined,
        postedAt: toIsoDate(r.date),
      });
    }
    return out;
  },
};
