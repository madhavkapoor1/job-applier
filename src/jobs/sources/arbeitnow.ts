import { fetchJson } from "../http.ts";
import type { JobSource, RawJob } from "../types.ts";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string; // HTML
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number; // epoch seconds
}

/**
 * Arbeitnow (https://www.arbeitnow.com) — keyless, paginated job board, strong
 * Europe + remote coverage across all industries. We pull the first few pages
 * for breadth; the central filter narrows to the user's keywords. Default on.
 */
export const arbeitnow: JobSource = {
  name: "arbeitnow",
  isEnabled: (c) => c.sources.arbeitnow?.enabled !== false,
  async fetch(): Promise<RawJob[]> {
    const pages = await Promise.all(
      [1, 2, 3].map(async (page): Promise<ArbeitnowJob[]> => {
        try {
          const data = await fetchJson<{ data?: ArbeitnowJob[] }>(
            `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
          );
          return data.data ?? [];
        } catch (err) {
          console.warn(`  [arbeitnow] page ${page}: ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const j of pages.flat()) {
      if (!j.slug || seen.has(j.slug)) continue;
      seen.add(j.slug);
      out.push({
        source: "arbeitnow",
        sourceId: j.slug,
        title: j.title,
        company: j.company_name,
        location: j.location ?? "",
        url: j.url,
        description: j.description ?? "",
        employmentType: j.job_types?.[0],
        department: j.tags?.[0],
        remote: j.remote,
        postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : undefined,
      });
    }
    return out;
  },
};
