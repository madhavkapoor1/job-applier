import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_PRESETS, findPreset } from "./presets.ts";
import { getRegions, adzunaCountries, googleLocations } from "./regions.ts";

test("presets: every preset has an id, label, and non-empty keywords", () => {
  for (const p of FIELD_PRESETS) {
    assert.ok(p.id && p.label, `${p.id} needs id + label`);
    assert.ok(p.keywords.length > 0, `${p.id} needs keywords`);
  }
});

test("presets: ids are unique and findable", () => {
  const ids = new Set(FIELD_PRESETS.map((p) => p.id));
  assert.equal(ids.size, FIELD_PRESETS.length, "duplicate preset id");
  assert.deepEqual(findPreset("healthcare")?.label, "Healthcare & Nursing");
  assert.equal(findPreset("nope"), undefined);
});

test("presets: cover a broad range of professions (not just tech)", () => {
  const ids = new Set(FIELD_PRESETS.map((p) => p.id));
  for (const need of ["legal", "healthcare", "finance", "education", "hospitality"]) {
    assert.ok(ids.has(need), `expected a ${need} preset for non-technical users`);
  }
});

test("regions: newly added countries resolve with google locations", () => {
  const regions = getRegions(["australia", "germany", "ireland", "singapore", "newzealand"]);
  assert.equal(regions.length, 5);
  assert.ok(googleLocations(["australia"]).includes("Australia"));
  // Ireland has no Adzuna endpoint but must still search via Google Jobs.
  assert.ok(!adzunaCountries(["ireland"]).length);
  assert.ok(googleLocations(["ireland"]).includes("Ireland"));
});
