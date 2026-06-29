import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getRegions,
  adzunaCountries,
  googleLocations,
  includesGlobal,
  locationInRegions,
} from "./regions.ts";

test("getRegions: resolves known ids and ignores unknown", () => {
  const r = getRegions(["uk", "canada", "nope"]);
  assert.deepEqual(r.map((x) => x.id), ["uk", "canada"]);
  assert.deepEqual(getRegions(undefined), []);
});

test("adzunaCountries: only Adzuna-covered regions, deduped", () => {
  // Dubai (no UAE endpoint) and Global (worldwide) contribute no country code.
  assert.deepEqual(adzunaCountries(["uk", "canada", "india", "dubai", "global"]), ["gb", "ca", "in"]);
  assert.deepEqual(adzunaCountries(["dubai", "global"]), []);
});

test("googleLocations: one entry per region, worldwide is undefined", () => {
  assert.deepEqual(googleLocations(["uk", "dubai", "global"]), [
    "United Kingdom",
    "Dubai, United Arab Emirates",
    undefined,
  ]);
  // No regions selected => a single worldwide query.
  assert.deepEqual(googleLocations([]), [undefined]);
});

test("googleLocations: de-dupes repeated worldwide markers", () => {
  // global twice should not produce two worldwide queries.
  assert.deepEqual(googleLocations(["global", "global"]), [undefined]);
});

test("includesGlobal: true only when global selected", () => {
  assert.equal(includesGlobal(["uk", "global"]), true);
  assert.equal(includesGlobal(["uk", "canada"]), false);
});

test("locationInRegions: matches city/country terms within selected regions", () => {
  assert.equal(locationInRegions("Toronto, ON", ["canada"]), true);
  assert.equal(locationInRegions("Dubai, UAE", ["dubai"]), true);
  assert.equal(locationInRegions("London, UK", ["uk"]), true);
  // Not in the selected regions.
  assert.equal(locationInRegions("Berlin, Germany", ["uk", "canada"]), false);
  // No regions or empty location => false (never a hard gate).
  assert.equal(locationInRegions("Toronto", []), false);
  assert.equal(locationInRegions("", ["canada"]), false);
});
