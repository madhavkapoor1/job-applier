import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface LeverPosting {
  id: string;
  text: string; // title
  descriptionPlain?: string;
  description?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string; // "remote" | "on-site" | "hybrid"
}

/** Lever public postings API. No key; needs company handles in config. */
export const lever: JobSource = {
  name: "lever",
  isEnabled: (c) => !!c.sources.lever?.companies?.length,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const batches = await Promise.all(
      config.sources.lever!.companies.map(async (company): Promise<RawJob[]> => {
        try {
          const posts = await fetchJson<LeverPosting[]>(
            `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
          );
          return posts.map((p) => ({
            source: "lever",
            sourceId: p.id,
            title: p.text,
            company,
            location: p.categories?.location ?? "",
            url: p.applyUrl ?? p.hostedUrl ?? "",
            description: p.descriptionPlain ?? p.description ?? "",
            department: p.categories?.team,
            employmentType: p.categories?.commitment,
            remote: p.workplaceType ? p.workplaceType.toLowerCase() === "remote" : undefined,
            postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
          }));
        } catch (err) {
          console.warn(`  [lever] ${company}: ${(err as Error).message}`);
          return [];
        }
      }),
    );
    return batches.flat();
  },
};
