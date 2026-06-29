import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface WkJob {
  id?: number | string;
  shortcode?: string;
  title: string;
  full_title?: string;
  url?: string;
  application_url?: string;
  shortlink?: string;
  location?: { city?: string; region?: string; country?: string };
  telecommuting?: boolean;
  department?: string;
  description?: string;
  created_at?: string;
  published_on?: string;
}

/** Workable public widget API. No key; needs account subdomains in config. */
export const workable: JobSource = {
  name: "workable",
  isEnabled: (c) => !!c.sources.workable?.companies?.length,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const batches = await Promise.all(
      config.sources.workable!.companies.map(async (account): Promise<RawJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: WkJob[]; name?: string }>(
            `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`,
          );
          const companyName = data.name ?? account;
          return (data.jobs ?? []).map((j) => ({
            source: "workable",
            sourceId: String(j.shortcode ?? j.id ?? ""),
            title: j.title,
            company: companyName,
            location: [j.location?.city, j.location?.region, j.location?.country]
              .filter(Boolean)
              .join(", "),
            url: j.application_url ?? j.url ?? j.shortlink ?? "",
            description: j.description ?? "",
            department: j.department,
            remote: j.telecommuting,
            postedAt: j.published_on ?? j.created_at,
          }));
        } catch (err) {
          console.warn(`  [workable] ${account}: ${(err as Error).message}`);
          return [];
        }
      }),
    );
    return batches.flat();
  },
};
