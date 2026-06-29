import { fetchJson } from "../http.ts";
import { decodeEntities } from "../normalize.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  content?: string; // HTML, entity-encoded
  location?: { name?: string };
  departments?: { name?: string }[];
}

/** Greenhouse public board API. No key; needs company board tokens in config. */
export const greenhouse: JobSource = {
  name: "greenhouse",
  isEnabled: (c) => !!c.sources.greenhouse?.companies?.length,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const batches = await Promise.all(
      config.sources.greenhouse!.companies.map(async (company): Promise<RawJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: GhJob[] }>(
            `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs?content=true`,
          );
          return (data.jobs ?? []).map((j) => ({
            source: "greenhouse",
            sourceId: String(j.id),
            title: j.title,
            company,
            location: j.location?.name ?? "",
            url: j.absolute_url,
            // Greenhouse double-encodes content; one extra decode pass before
            // normalize.stripHtml's own decode.
            description: decodeEntities(j.content ?? ""),
            department: j.departments?.[0]?.name,
            postedAt: j.updated_at,
          }));
        } catch (err) {
          console.warn(`  [greenhouse] ${company}: ${(err as Error).message}`);
          return [];
        }
      }),
    );
    return batches.flat();
  },
};
