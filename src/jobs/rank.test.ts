import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreJob, passesFilters } from "./rank.ts";
import type { AppConfig, Job } from "./types.ts";

function config(overrides: Partial<AppConfig["search"]> = {}, skills: string[] = []): AppConfig {
  return {
    profile: { name: "x", email: "x@x.com", summary: "", skills, experience: [], education: [] },
    search: {
      keywords: ["software engineer"],
      regions: [],
      locations: [],
      remoteOnly: false,
      minScore: 0,
      ...overrides,
    },
    sources: {},
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "1",
    source: "test",
    title: "Software Engineer",
    company: "Acme",
    location: "London",
    remote: false,
    url: "https://example.com/job/1",
    description: "We build software.",
    discoveredAt: "2026-01-01T00:00:00.000Z",
    score: 0,
    matchedKeywords: [],
    ...overrides,
  };
}

test("scoreJob: title keyword hit scores higher than description-only hit", () => {
  const titleHit = scoreJob(job({ title: "Software Engineer", description: "x" }), config());
  const descHit = scoreJob(
    job({ title: "Office Manager", description: "occasional software engineer support" }),
    config(),
  );
  assert.ok(titleHit.score > descHit.score, `title ${titleHit.score} should beat desc ${descHit.score}`);
  assert.ok(titleHit.matchedKeywords.includes("software engineer"));
});

test("wordMatch: short skills do NOT match inside unrelated words (the 337-bug)", () => {
  // "C", "Go", "AI" must not match "category", "Diego", "email", etc.
  const j = scoreJob(
    job({ title: "Category Manager", description: "Email the San Diego team about retail." }),
    config({ keywords: ["category manager"] }, ["C", "Go", "AI"]),
  );
  assert.deepEqual(
    j.matchedKeywords.filter((k) => ["c", "go", "ai"].includes(k)),
    [],
    "short skills should not substring-match unrelated words",
  );
});

test("wordMatch: short skills DO match as whole words", () => {
  const j = scoreJob(
    job({ title: "Software Engineer", description: "Strong C and Go experience; some AI work." }),
    config({ keywords: ["software engineer"] }, ["C", "Go", "AI"]),
  );
  for (const skill of ["c", "go", "ai"]) {
    assert.ok(j.matchedKeywords.includes(skill), `expected whole-word skill "${skill}" to match`);
  }
});

test("scoreJob: location/remote/freshness bonuses only apply to relevant jobs", () => {
  // Irrelevant job in the right city + remote + fresh should NOT collect bonuses.
  const irrelevant = scoreJob(
    job({
      title: "Plumber",
      description: "Fix pipes.",
      location: "London",
      remote: true,
      postedAt: "2026-01-01T00:00:00.000Z",
    }),
    config({ locations: ["London"] }),
  );
  assert.equal(irrelevant.score, 0, "off-topic job must not score on location/remote alone");
});

test("scoreJob: region match adds a ranking bonus without being required", () => {
  const inRegion = scoreJob(job({ location: "Toronto, ON" }), config({ regions: ["canada"] }));
  const outRegion = scoreJob(job({ location: "Berlin, Germany" }), config({ regions: ["canada"] }));
  assert.ok(inRegion.score > outRegion.score, "in-region job should rank above out-of-region");
});

test("passesFilters: requires a usable url", () => {
  assert.equal(passesFilters(job({ url: "" }), config()), false);
  assert.equal(passesFilters(job({ url: "https://x.com" }), config()), true);
});

test("passesFilters: title must contain a search keyword (eligibility gate)", () => {
  const cfg = config({ keywords: ["paralegal", "legal counsel"] });
  // A fintech eng role that only mentions 'legal' in the body must not pass.
  const engRole = scoreJob(
    job({ title: "Backend Engineer", description: "work with our legal team on compliance" }),
    cfg,
  );
  assert.equal(passesFilters(engRole, cfg), false);
  const legalRole = scoreJob(job({ title: "Paralegal", description: "legal research" }), cfg);
  assert.equal(passesFilters(legalRole, cfg), true);
});

test("passesFilters: excludeTitleKeywords drops matching titles", () => {
  const cfg = config({ keywords: ["engineer"], excludeTitleKeywords: ["senior"] });
  const senior = scoreJob(job({ title: "Senior Software Engineer" }), cfg);
  assert.equal(passesFilters(senior, cfg), false);
});

test("passesFilters: remoteOnly drops non-remote jobs", () => {
  const cfg = config({ keywords: ["engineer"], remoteOnly: true });
  assert.equal(passesFilters(scoreJob(job({ title: "Engineer", remote: false }), cfg), cfg), false);
  assert.equal(passesFilters(scoreJob(job({ title: "Engineer", remote: true }), cfg), cfg), true);
});

test("passesFilters: minScore threshold is enforced", () => {
  const lo = config({ keywords: ["software engineer"], minScore: 0 });
  const hi = config({ keywords: ["software engineer"], minScore: 99 });
  const j = scoreJob(job(), lo);
  assert.equal(passesFilters(j, lo), true);
  assert.equal(passesFilters(scoreJob(job(), hi), hi), false);
});
