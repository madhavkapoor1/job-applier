import { fetchJson } from "../http.ts";
import type { JobSource, RawJob } from "../types.ts";

interface RemoteOkJob {
  slug?: string;
  id?: string;
  date?: string; // ISO
  company?: string;
  position?: string;
  description?: string; // HTML
  tags?: string[];
  location?: string;
  url?: string;
  apply_url?: string;
  /** The first array element is a metadata row carrying only this field. */
  legal?: string;
}

/**
 * Remote OK (https://remoteok.com) — keyless JSON feed of remote roles across
 * many fields (engineering, design, sales, support, HR, finance, legal…). The
 * first array element is a legal/metadata object and is skipped. Their terms ask
 * for a link back, satisfied by linking to the job url on apply. Default on;
 * the central title-keyword filter narrows the feed to the user's search.
 */
export const remoteok: JobSource = {
  name: "remoteok",
  isEnabled: (c) => c.sources.remoteok?.enabled !== false,
  async fetch(): Promise<RawJob[]> {
    let jobs: RemoteOkJob[];
    try {
      jobs = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
    } catch (err) {
      console.warn(`  [remoteok]: ${(err as Error).message}`);
      return [];
    }

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const j of jobs) {
      if (j.legal || !j.position) continue; // metadata row / incomplete
      const id = j.id ?? j.slug;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const url =
        j.url ?? j.apply_url ?? (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : "");
      out.push({
        source: "remoteok",
        sourceId: id,
        title: j.position,
        company: j.company ?? "Unknown",
        location: j.location || "Remote",
        url,
        description: j.description ?? "",
        department: j.tags?.[0],
        remote: true,
        postedAt: j.date,
      });
    }
    return out;
  },
};
