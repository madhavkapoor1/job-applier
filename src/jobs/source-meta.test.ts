import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectSource, atsFromUrl, isAssistable } from "./source-meta.ts";

test("isDirectSource: ATS / Google Jobs / USAJobs are direct", () => {
  for (const s of ["greenhouse", "lever", "ashby", "workable", "serpapi", "usajobs"]) {
    assert.equal(isDirectSource(s), true, `${s} should be direct`);
  }
});

test("isDirectSource: aggregators are not direct", () => {
  for (const s of ["jobicy", "remoteok", "arbeitnow", "himalayas", "remotive", "themuse", "reed", "adzuna", "customfeeds"]) {
    assert.equal(isDirectSource(s), false, `${s} should not be direct`);
  }
});

test("isDirectSource: unknown source is not direct", () => {
  assert.equal(isDirectSource("nope"), false);
});

test("atsFromUrl: recognises each supported ATS by host", () => {
  assert.equal(atsFromUrl("https://boards.greenhouse.io/acme/jobs/123"), "greenhouse");
  assert.equal(atsFromUrl("https://job-boards.greenhouse.io/acme/jobs/1"), "greenhouse");
  assert.equal(atsFromUrl("https://jobs.lever.co/acme/abc-def"), "lever");
  assert.equal(atsFromUrl("https://jobs.ashbyhq.com/acme/xyz"), "ashby");
  assert.equal(atsFromUrl("https://apply.workable.com/acme/j/ABCDEF/"), "workable");
});

test("atsFromUrl: non-ATS and junk urls return undefined", () => {
  assert.equal(atsFromUrl("https://www.reed.co.uk/jobs/paralegal/123"), undefined);
  assert.equal(atsFromUrl("not a url"), undefined);
  assert.equal(atsFromUrl(""), undefined);
});

test("isAssistable: true for ATS urls or ATS sources", () => {
  assert.equal(isAssistable("https://jobs.lever.co/x/y", "serpapi"), true); // url wins
  assert.equal(isAssistable("https://example.com/apply", "greenhouse"), true); // source wins
  assert.equal(isAssistable("https://www.reed.co.uk/jobs/1", "reed"), false);
});
