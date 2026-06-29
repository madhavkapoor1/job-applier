import { fetchJson } from "../http.ts";
import { env } from "../config.ts";
import { narrowCity } from "../locations.ts";
import { adzunaCountries } from "../regions.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface AdzunaResult {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url: string;
  description?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
}

/** Adzuna aggregator. Needs ADZUNA_APP_ID + ADZUNA_APP_KEY (free tier). */
export const adzuna: JobSource = {
  name: "adzuna",
  isEnabled: (c) =>
    c.sources.adzuna?.enabled === true && !!env("ADZUNA_APP_ID") && !!env("ADZUNA_APP_KEY"),
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const appId = env("ADZUNA_APP_ID")!;
    const appKey = env("ADZUNA_APP_KEY")!;
    // Countries come from the selected regions; fall back to the legacy
    // single-country setting (or "gb") when no Adzuna-covered region is chosen.
    const countries = adzunaCountries(config.search.regions);
    if (!countries.length) countries.push((config.sources.adzuna?.country ?? "gb").toLowerCase());

    // Adzuna's `what_or` matches any of the space-separated terms.
    const what = encodeURIComponent(config.search.keywords.join(" "));
    // Only narrow by city when the search isn't country-wide — the country is
    // already fixed by the API path, so a "United Kingdom" entry means no `where`.
    const city = narrowCity(config.search.locations);
    const where = city ? `&where=${encodeURIComponent(city)}` : "";

    const out: RawJob[] = [];
    const seen = new Set<string>();
    const batches = await Promise.all(
      countries.map(async (country): Promise<AdzunaResult[]> => {
        try {
          const data = await fetchJson<{ results?: AdzunaResult[] }>(
            `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}` +
              `&results_per_page=50&what_or=${what}${where}&content-type=application/json`,
          );
          return data.results ?? [];
        } catch (err) {
          console.warn(`  [adzuna] ${country}: ${(err as Error).message}`);
          return [];
        }
      }),
    );

    for (const r of batches.flat()) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        source: "adzuna",
        sourceId: r.id,
        title: r.title,
        company: r.company?.display_name ?? "Unknown",
        location: r.location?.display_name ?? "",
        url: r.redirect_url,
        description: r.description ?? "",
        employmentType: r.contract_time,
        salary:
          r.salary_min != null || r.salary_max != null
            ? { min: r.salary_min, max: r.salary_max, period: "year" }
            : undefined,
        postedAt: r.created,
      });
    }
    return out;
  },
};
