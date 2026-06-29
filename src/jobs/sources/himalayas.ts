import { fetchJson } from "../http.ts";
import type { JobSource, RawJob, Salary } from "../types.ts";

interface HimalayasJob {
  title: string;
  companyName: string;
  excerpt?: string;
  description?: string; // HTML
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  salaryPeriod?: string; // e.g. "annual"
  locationRestrictions?: string[];
  categories?: string[];
  pubDate?: number; // epoch seconds
  applicationLink?: string;
  guid?: string;
}

const PERIOD: Record<string, Salary["period"]> = {
  annual: "year",
  monthly: "month",
  hourly: "hour",
  daily: "day",
};

/**
 * Himalayas (https://himalayas.app) — keyless remote-jobs feed (80k+ live),
 * broad across industries, with location restrictions and salary. Paginated via
 * limit/offset; we pull a couple of pages for breadth. Default on.
 */
export const himalayas: JobSource = {
  name: "himalayas",
  isEnabled: (c) => c.sources.himalayas?.enabled !== false,
  async fetch(): Promise<RawJob[]> {
    const pages = await Promise.all(
      [0, 1].map(async (i): Promise<HimalayasJob[]> => {
        try {
          const data = await fetchJson<{ jobs?: HimalayasJob[] }>(
            `https://himalayas.app/jobs/api?limit=100&offset=${i * 100}`,
          );
          return data.jobs ?? [];
        } catch (err) {
          console.warn(`  [himalayas] offset ${i * 100}: ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const j of pages.flat()) {
      const id = j.guid ?? j.applicationLink ?? `${j.companyName}|${j.title}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const hasSalary = j.minSalary != null || j.maxSalary != null;
      out.push({
        source: "himalayas",
        sourceId: id,
        title: j.title,
        company: j.companyName,
        location: j.locationRestrictions?.join(", ") || "Remote",
        url: j.applicationLink ?? j.guid ?? "",
        description: j.description ?? j.excerpt ?? "",
        employmentType: j.employmentType,
        department: j.categories?.[0],
        salary: hasSalary
          ? {
              min: j.minSalary,
              max: j.maxSalary,
              currency: j.currency,
              period: j.salaryPeriod ? PERIOD[j.salaryPeriod.toLowerCase()] : undefined,
            }
          : undefined,
        remote: true,
        postedAt: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : undefined,
      });
    }
    return out;
  },
};
