import { fetchJson } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface MuseJob {
  id: number;
  name: string;
  type?: string;
  contents?: string; // HTML
  company?: { name?: string };
  locations?: { name?: string }[];
  categories?: { name?: string }[];
  publication_date?: string;
  refs?: { landing_page?: string };
}

const REMOTE_RE = /flexible|remote/i;

/**
 * The Muse public API — keyless. Category and location filtering both come
 * from config (sources.themuse.category, search.locations) so retargeting the
 * app never requires editing this file.
 */
export const themuse: JobSource = {
  name: "themuse",
  isEnabled: (c) => c.sources.themuse?.enabled !== false,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const category = config.sources.themuse?.category ?? "Legal Services";
    const wanted = config.search.locations.map((l) => l.toLowerCase());
    // Keep a posting when it's remote, matches a configured location, or no
    // locations are configured at all (= anywhere).
    const keep = (location: string) =>
      !wanted.length ||
      REMOTE_RE.test(location) ||
      wanted.some((l) => location.toLowerCase().includes(l));

    const out: RawJob[] = [];
    const seen = new Set<number>();
    for (let page = 0; page <= 4; page++) {
      try {
        const data = await fetchJson<{ results?: MuseJob[]; page_count?: number }>(
          `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(category)}&page=${page}`,
        );
        for (const j of data.results ?? []) {
          if (seen.has(j.id)) continue;
          const location = (j.locations ?? []).map((l) => l.name).filter(Boolean).join(", ");
          if (!keep(location)) continue;
          seen.add(j.id);
          out.push({
            source: "themuse",
            sourceId: String(j.id),
            title: j.name,
            company: j.company?.name ?? "Unknown",
            location,
            url: j.refs?.landing_page ?? "",
            description: j.contents ?? "",
            department: j.categories?.[0]?.name,
            employmentType: j.type,
            remote: REMOTE_RE.test(location),
            postedAt: j.publication_date,
          });
        }
        if (data.page_count !== undefined && page >= data.page_count - 1) break;
      } catch (err) {
        console.warn(`  [themuse] page ${page}: ${(err as Error).message}`);
        break;
      }
    }
    return out;
  },
};
