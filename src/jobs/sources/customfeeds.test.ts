import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "./customfeeds.ts";

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example Board</title>
    <item>
      <title>Acme Corp: Senior Backend Engineer</title>
      <link>https://example.com/jobs/1?a=1&amp;b=2</link>
      <guid>job-1</guid>
      <region>London, UK</region>
      <type>Full-Time</type>
      <category>Engineering</category>
      <pubDate>Sat, 27 Jun 2026 01:08:59 +0000</pubDate>
      <description><![CDATA[<p>Build &amp; ship things.</p>]]></description>
    </item>
    <item>
      <title>Plain Job Title With No Company</title>
      <link>https://example.com/jobs/2</link>
      <dc:creator>Globex</dc:creator>
      <description>Plain text desc</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Board</title>
  <entry>
    <title>Frontend Developer</title>
    <link href="https://atom.example.com/jobs/9" />
    <published>2026-06-01T10:00:00Z</published>
    <summary>Atom summary text</summary>
  </entry>
</feed>`;

test("parseFeed: splits 'Company: Role' titles and extracts fields", () => {
  const jobs = parseFeed(RSS, "https://example.com/feed");
  const j = jobs[0];
  assert.equal(j.company, "Acme Corp");
  assert.equal(j.title, "Senior Backend Engineer");
  assert.equal(j.url, "https://example.com/jobs/1?a=1&b=2", "&amp; in link is decoded");
  assert.equal(j.location, "London, UK");
  assert.equal(j.employmentType, "Full-Time");
  assert.equal(j.department, "Engineering");
  assert.equal(j.sourceId, "job-1");
  assert.ok(j.postedAt?.startsWith("2026-06-27"), "RFC-822 date parsed to ISO");
  assert.ok(j.description.includes("Build"), "CDATA description unwrapped");
});

test("parseFeed: explicit author field used as company; title kept whole", () => {
  const jobs = parseFeed(RSS, "https://example.com/feed");
  const j = jobs[1];
  assert.equal(j.company, "Globex");
  assert.equal(j.title, "Plain Job Title With No Company");
});

test("parseFeed: does not split role-ish prefixes like 'Senior Engineer: Backend'", () => {
  const xml = `<rss><channel><title>F</title>
    <item><title>Senior Engineer: Backend</title><link>https://x.com/1</link></item>
  </channel></rss>`;
  const j = parseFeed(xml, "https://x.com/feed")[0];
  assert.equal(j.title, "Senior Engineer: Backend", "role prefix not mistaken for a company");
  assert.equal(j.company, "F", "falls back to feed name");
});

test("parseFeed: Atom <entry> with href link and summary", () => {
  const jobs = parseFeed(ATOM, "https://atom.example.com/feed");
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.title, "Frontend Developer");
  assert.equal(j.url, "https://atom.example.com/jobs/9", "Atom link href extracted");
  assert.equal(j.company, "Atom Board", "no company => feed name");
  assert.ok(j.postedAt?.startsWith("2026-06-01"));
  assert.ok(j.description.includes("Atom summary"));
});

test("parseFeed: tolerates empty / malformed input", () => {
  assert.deepEqual(parseFeed("", "https://x.com/feed"), []);
  assert.deepEqual(parseFeed("<rss><channel></channel></rss>", "https://x.com/feed"), []);
});
