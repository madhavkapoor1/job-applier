import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, applyCliProfileArg } from "./profiles.ts";

test("slugify: names become path-safe directory slugs", () => {
  assert.equal(slugify("Madhav Kapoor"), "madhav-kapoor");
  assert.equal(slugify("  Anna-Marie O'Brien  "), "anna-marie-o-brien");
  assert.equal(slugify("法律"), "profile"); // non-latin falls back rather than empty
  assert.equal(slugify("../../etc/passwd"), "etc-passwd"); // no traversal characters survive
});

test("slugify: caps length and never returns empty", () => {
  assert.equal(slugify(""), "profile");
  assert.equal(slugify("!!!"), "profile");
  assert.ok(slugify("x".repeat(100)).length <= 40);
});

test("applyCliProfileArg: sets the env override and strips the tokens", () => {
  const prev = process.env.JOB_APPLIER_PROFILE;
  try {
    const argv = ["node", "script.ts", "abc123", "--profile", "Sister", "applied"];
    applyCliProfileArg(argv);
    assert.equal(process.env.JOB_APPLIER_PROFILE, "Sister");
    assert.deepEqual(argv, ["node", "script.ts", "abc123", "applied"]);
  } finally {
    if (prev === undefined) delete process.env.JOB_APPLIER_PROFILE;
    else process.env.JOB_APPLIER_PROFILE = prev;
  }
});
