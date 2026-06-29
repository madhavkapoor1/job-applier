import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, stripHtml, jobId, finalize, dedupe } from "./normalize.ts";
import type { Job, RawJob } from "./types.ts";

test("decodeEntities: named, numeric, and hex entities", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(decodeEntities("a&#47;b"), "a/b"); // numeric
  assert.equal(decodeEntities("a&#x2F;b"), "a/b"); // hex (the &#x2F; bug)
  assert.equal(decodeEntities("&quot;hi&quot;"), '"hi"');
});

test("stripHtml: removes tags, keeps text, collapses whitespace", () => {
  const out = stripHtml("<p>Hello   <b>world</b></p><br><li>one</li>");
  assert.ok(!out.includes("<"), "no angle brackets remain");
  assert.ok(out.includes("Hello world"));
  assert.ok(out.includes("one"));
});

test("jobId: stable for same inputs, ignores case/punctuation/whitespace", () => {
  const a = jobId("Acme Inc", "Software Engineer", "London");
  const b = jobId("  acme   inc ", "software-engineer", "LONDON");
  assert.equal(a, b, "normalized inputs collapse to the same id");
  assert.notEqual(a, jobId("Acme Inc", "Product Manager", "London"));
  assert.match(a, /^[0-9a-f]{16}$/);
});

test("finalize: fills id/remote/timestamps and cleans fields", () => {
  const raw: RawJob = {
    source: "test",
    title: "  Engineer &amp; Builder ",
    company: " Acme ",
    location: "Remote - US",
    url: "https://x.com",
    description: "<p>Build <b>things</b></p>",
  };
  const j = finalize(raw, "2026-01-01T00:00:00.000Z");
  assert.equal(j.title, "Engineer & Builder");
  assert.equal(j.company, "Acme");
  assert.equal(j.remote, true, "inferred remote from location");
  assert.equal(j.description, "Build things");
  assert.equal(j.discoveredAt, "2026-01-01T00:00:00.000Z");
  assert.match(j.id, /^[0-9a-f]{16}$/);
});

test("finalize: explicit remote flag wins over inference", () => {
  const j = finalize(
    { source: "t", title: "Engineer", company: "A", location: "London", url: "u", description: "", remote: false },
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(j.remote, false);
});

test("finalize: blanks fall back to safe defaults", () => {
  const j = finalize({ source: "t", title: "", company: "", location: "", url: "", description: "" }, "now");
  assert.equal(j.company, "Unknown");
  assert.equal(j.title, "Untitled");
  assert.equal(j.location, "Unspecified");
});

test("dedupe: collapses same id, keeping the richer description", () => {
  const base: Job = finalize(
    { source: "t", title: "Engineer", company: "Acme", location: "London", url: "u", description: "short" },
    "now",
  );
  const richer: Job = { ...base, description: "a much longer and richer description" };
  const out = dedupe([base, richer]);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, richer.description);
});
