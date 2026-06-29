import { fetchJson } from "../http.ts";
import { env } from "../config.ts";
import { narrowCity } from "../locations.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface UsaItem {
  MatchedObjectDescriptor?: {
    PositionTitle?: string;
    OrganizationName?: string;
    PositionLocationDisplay?: string;
    PositionURI?: string;
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
    PublicationStartDate?: string;
    UserArea?: { Details?: { JobSummary?: string } };
  };
}

/** USAJobs (US federal). Needs USAJOBS_API_KEY + USAJOBS_EMAIL (free). */
export const usajobs: JobSource = {
  name: "usajobs",
  isEnabled: (c) =>
    c.sources.usajobs?.enabled === true && !!env("USAJOBS_API_KEY") && !!env("USAJOBS_EMAIL"),
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const headers = {
      "Authorization-Key": env("USAJOBS_API_KEY")!,
      "User-Agent": env("USAJOBS_EMAIL")!,
      Host: "data.usajobs.gov",
    };
    const out: RawJob[] = [];
    const seen = new Set<string>();
    const keyword = encodeURIComponent(config.search.keywords.join(" "));
    const city = narrowCity(config.search.locations);
    const loc = city ? `&LocationName=${encodeURIComponent(city)}` : "";
    try {
      const data = await fetchJson<{ SearchResult?: { SearchResultItems?: UsaItem[] } }>(
        `https://data.usajobs.gov/api/search?Keyword=${keyword}&ResultsPerPage=50${loc}`,
        { headers },
      );
      for (const item of data.SearchResult?.SearchResultItems ?? []) {
        const d = item.MatchedObjectDescriptor;
        if (!d?.PositionURI) continue;
        if (seen.has(d.PositionURI)) continue;
        seen.add(d.PositionURI);
        const pay = d.PositionRemuneration?.[0];
        out.push({
          source: "usajobs",
          title: d.PositionTitle ?? "Federal position",
          company: d.OrganizationName ?? "US Government",
          location: d.PositionLocationDisplay ?? "",
          url: d.PositionURI,
          description: d.UserArea?.Details?.JobSummary ?? "",
          salary: pay
            ? {
                min: pay.MinimumRange ? Number(pay.MinimumRange) : undefined,
                max: pay.MaximumRange ? Number(pay.MaximumRange) : undefined,
                period: "year",
              }
            : undefined,
          postedAt: d.PublicationStartDate,
        });
      }
    } catch (err) {
      console.warn(`  [usajobs]: ${(err as Error).message}`);
    }
    return out;
  },
};
