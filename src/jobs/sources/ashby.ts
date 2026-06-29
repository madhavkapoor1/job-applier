import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  isRemote?: boolean;
  isListed?: boolean;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
}

/** Ashby public job-board API. No key; needs org slugs in config. */
export const ashby: JobSource = {
  name: "ashby",
  isEnabled: (c) => !!c.sources.ashby?.companies?.length,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const batches = await Promise.all(
      config.sources.ashby!.companies.map(async (company): Promise<RawJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: AshbyJob[] }>(
            `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}?includeCompensation=true`,
          );
          return (data.jobs ?? [])
            .filter((j) => j.isListed !== false)
            .map((j) => ({
              source: "ashby",
              sourceId: j.id,
              title: j.title,
              company,
              location: j.location ?? "",
              url: j.applyUrl ?? j.jobUrl ?? "",
              description: j.descriptionPlain ?? j.descriptionHtml ?? "",
              department: j.department ?? j.team,
              employmentType: j.employmentType,
              remote: j.isRemote,
              postedAt: j.publishedAt,
            }));
        } catch (err) {
          console.warn(`  [ashby] ${company}: ${(err as Error).message}`);
          return [];
        }
      }),
    );
    return batches.flat();
  },
};
