import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string; // HTML
  pubDate?: string; // ISO
}

/**
 * Jobicy (https://jobicy.com) — keyless remote-jobs API spanning many industries
 * (incl. sales, HR, finance, legal, support). Queried per keyword via `tag` for
 * relevance, deduped by id. Default on.
 */
export const jobicy: JobSource = {
  name: "jobicy",
  isEnabled: (c) => c.sources.jobicy?.enabled !== false,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    // Jobicy's `tag` filter rejects terms shorter than 3 chars (e.g. "AI", "ML").
    const tags = config.search.keywords.filter((k) => k.trim().length >= 3);
    const batches = await Promise.all(
      tags.map(async (kw): Promise<JobicyJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: JobicyJob[] }>(
            `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(kw)}`,
          );
          return data.jobs ?? [];
        } catch (err) {
          console.warn(`  [jobicy] "${kw}": ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<number>();
    for (const j of batches.flat()) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      out.push({
        source: "jobicy",
        sourceId: String(j.id),
        title: j.jobTitle,
        company: j.companyName,
        location: j.jobGeo || "Remote",
        url: j.url,
        description: j.jobDescription ?? j.jobExcerpt ?? "",
        employmentType: j.jobType?.[0],
        department: j.jobIndustry?.[0],
        remote: true,
        postedAt: j.pubDate,
      });
    }
    return out;
  },
};
