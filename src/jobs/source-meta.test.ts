import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectSource } from "./source-meta.ts";

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
