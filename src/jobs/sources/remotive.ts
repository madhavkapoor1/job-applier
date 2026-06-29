import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  url: string;
  description?: string; // HTML
  publication_date?: string;
  job_type?: string;
  category?: string;
}

/** Remotive remote-jobs API. No key. Queried once per keyword. */
export const remotive: JobSource = {
  name: "remotive",
  isEnabled: (c) => c.sources.remotive?.enabled !== false,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const batches = await Promise.all(
      config.search.keywords.map(async (kw): Promise<RemotiveJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: RemotiveJob[] }>(
            `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=50`,
          );
          return data.jobs ?? [];
        } catch (err) {
          console.warn(`  [remotive] "${kw}": ${(err as Error).message}`);
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
        source: "remotive",
        sourceId: String(j.id),
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        url: j.url,
        description: j.description ?? "",
        employmentType: j.job_type,
        department: j.category,
        remote: true,
        postedAt: j.publication_date,
      });
    }
    return out;
  },
};
