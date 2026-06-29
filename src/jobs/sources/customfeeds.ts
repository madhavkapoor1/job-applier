import { fetchText } from "../http.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

/**
 * Generic RSS / Atom job-feed source — the "add any board without code" escape
 * hatch. The user pastes one or more feed URLs (config.sources.customfeeds.urls)
 * and every item becomes a job. A huge number of boards publish a feed
 * (WeWorkRemotely, niche/country boards, company career pages…), so this covers
 * the long tail we'd otherwise never hand-write an adapter for.
 *
 * Parsing is intentionally dependency-free and tolerant: it pulls the flat
 * fields a job feed actually uses (title, link, description, date, and a few
 * common location/company variants) and lets the central pipeline normalize,
 * strip HTML, score, and keyword-filter. Anything more exotic (bespoke JSON
 * APIs, auth) belongs in a real coded JobSource — see CONTRIBUTING.md.
 */
export const customfeeds: JobSource = {
  name: "customfeeds",
  isEnabled: (c) => (c.sources.customfeeds?.urls?.length ?? 0) > 0,
  async fetch(config: AppConfig): Promise<RawJob[]> {
    const urls = (config.sources.customfeeds?.urls ?? []).map((u) => u.trim()).filter(Boolean);

    const batches = await Promise.all(
      urls.map(async (url): Promise<RawJob[]> => {
        try {
          const xml = await fetchText(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
          return parseFeed(xml, url);
        } catch (err) {
          console.warn(`  [customfeeds] ${url}: ${(err as Error).message}`);
          return [];
        }
      }),
    );

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const job of batches.flat()) {
      const key = job.url || job.sourceId || `${job.company}|${job.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
    }
    return out;
  },
};

/** Pull RSS <item> or Atom <entry> blocks and map each to a RawJob. Exported for tests. */
export function parseFeed(xml: string, feedUrl: string): RawJob[] {
  const channelTitle = stripTags(tag(xml, "title")) || hostOf(feedUrl);
  const blocks = blockMatches(xml, "item").concat(blockMatches(xml, "entry"));

  const jobs: RawJob[] = [];
  for (const block of blocks) {
    const rawTitle = stripTags(tag(block, "title"));
    if (!rawTitle) continue;

    const link = itemLink(block);
    const description = tag(block, "content:encoded") || tag(block, "description") || tag(block, "summary") || tag(block, "content");
    const date = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");

    // Company: explicit author-ish field, else the common "Company: Role" title
    // pattern (used by WeWorkRemotely and others), else the feed's own name.
    const explicitCompany = stripTags(tag(block, "dc:creator") || tag(block, "author") || tag(block, "company"));
    const { company, title } = splitCompanyTitle(rawTitle, explicitCompany, channelTitle);

    const location = stripTags(tag(block, "region") || tag(block, "location") || tag(block, "job_listing_location") || "");

    jobs.push({
      source: "customfeeds",
      sourceId: stripTags(tag(block, "guid")) || link || undefined,
      title,
      company: company || "Unknown",
      location,
      url: link,
      description,
      department: stripTags(tag(block, "category")) || undefined,
      employmentType: stripTags(tag(block, "type") || tag(block, "job_listing_job_type")) || undefined,
      postedAt: date ? toIso(date) : undefined,
    });
  }
  return jobs;
}

/** All inner blocks for a repeating element name, e.g. <item>…</item>. */
function blockMatches(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/** Inner text of the first <name>…</name>, with CDATA unwrapped. Empty if absent. */
function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = re.exec(block);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Link as RSS text <link>url</link> or Atom <link href="url"/>. */
function itemLink(block: string): string {
  const text = tag(block, "link");
  if (text) return decodeAmp(text);
  const href = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(block);
  return href ? decodeAmp(href[1]) : "";
}

/**
 * Resolve (company, title). Prefer an explicit author field; otherwise, when the
 * title looks like "Company: Role" with a short, company-like prefix, split it;
 * otherwise keep the whole title and label company with the feed name.
 */
function splitCompanyTitle(
  rawTitle: string,
  explicitCompany: string,
  feedName: string,
): { company: string; title: string } {
  if (explicitCompany) return { company: explicitCompany, title: rawTitle };
  const idx = rawTitle.indexOf(": ");
  if (idx > 1 && idx <= 40) {
    const prefix = rawTitle.slice(0, idx).trim();
    const rest = rawTitle.slice(idx + 2).trim();
    // Avoid splitting role-ish prefixes like "Senior Engineer: Backend".
    if (rest && !/\b(engineer|manager|developer|designer|lead|director|analyst|specialist|coordinator|officer|counsel|associate)\b/i.test(prefix)) {
      return { company: prefix, title: rest };
    }
  }
  return { company: feedName, title: rawTitle };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function decodeAmp(s: string): string {
  return s.replace(/&amp;/g, "&").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "feed";
  }
}

/** RSS dates are RFC-822; Atom are ISO. Date.parse handles both — normalize to ISO. */
function toIso(d: string): string | undefined {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}
