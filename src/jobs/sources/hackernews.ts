import { fetchJson } from "../http.ts";
import { stripHtml } from "../normalize.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

interface AlgoliaHit {
  objectID: string;
  title?: string;
  created_at?: string;
}
interface HnItem {
  id: number;
  children?: HnItem[];
  text?: string; // HTML
  author?: string;
  created_at?: string;
}

/**
 * HN "Ask HN: Who is hiring?" monthly threads (via Algolia API). No key.
 * Comments are freeform; we keyword-filter and best-effort parse "Company | Role | Location".
 */
export const hackernews: JobSource = {
  name: "hackernews",
  isEnabled: (c) => c.sources.hackernews?.enabled !== false,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const monthsBack = config.sources.hackernews?.monthsBack ?? 1;
    const out: RawJob[] = [];
    let stories: AlgoliaHit[] = [];
    try {
      const search = await fetchJson<{ hits?: AlgoliaHit[] }>(
        "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=hiring&hitsPerPage=12",
      );
      stories = (search.hits ?? [])
        .filter((h) => /who is hiring/i.test(h.title ?? ""))
        .slice(0, monthsBack);
    } catch (err) {
      console.warn(`  [hackernews] thread lookup: ${(err as Error).message}`);
      return out;
    }

    const kws = config.search.keywords.map((k) => k.toLowerCase());
    for (const story of stories) {
      try {
        const item = await fetchJson<HnItem>(
          `https://hn.algolia.com/api/v1/items/${story.objectID}`,
          { timeoutMs: 30_000 },
        );
        for (const c of item.children ?? []) {
          if (!c.text) continue;
          const text = stripHtml(c.text);
          const hay = text.toLowerCase();
          if (!kws.some((k) => hay.includes(k))) continue; // only keep relevant posts
          out.push(parseComment(text, c, story.title ?? "Who is hiring"));
        }
      } catch (err) {
        console.warn(`  [hackernews] ${story.objectID}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};

function parseComment(text: string, c: HnItem, threadTitle: string): RawJob {
  // Top line is usually "Company | Role | Location | REMOTE | ...".
  const firstLine = text.split("\n")[0].trim();
  const parts = firstLine.split(/\s*[|•·–—-]\s*/).filter(Boolean);
  const company = parts[0]?.slice(0, 80) || "HN poster";
  const title = parts[1]?.slice(0, 120) || firstLine.slice(0, 120) || "See post";
  const location = parts.slice(2).join(", ").slice(0, 120) || "See post";
  return {
    source: "hackernews",
    sourceId: String(c.id),
    title,
    company,
    location,
    url: `https://news.ycombinator.com/item?id=${c.id}`,
    description: text,
    department: threadTitle,
    postedAt: c.created_at,
  };
}
