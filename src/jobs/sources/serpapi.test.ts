import { test } from "node:test";
import assert from "node:assert/strict";
import { pickGoogleLocations } from "./serpapi.ts";
import type { AppConfig } from "../types.ts";

function cfg(locations: string[], regions: string[], sourceLoc?: string): AppConfig {
  return {
    profile: { name: "x", email: "x@x.com", summary: "", skills: [], experience: [], education: [] },
    search: { keywords: ["k"], regions, locations, remoteOnly: false, minScore: 0 },
    sources: { serpapi: { enabled: true, location: sourceLoc } },
  };
}

test("pickGoogleLocations: a specific city wins even when a region is selected (the bug)", () => {
  assert.deepEqual(pickGoogleLocations(cfg(["Manchester"], ["uk"])), ["Manchester"]);
  assert.deepEqual(pickGoogleLocations(cfg(["Toronto", "Ottawa"], ["canada", "us"])), ["Toronto", "Ottawa"]);
});

test("pickGoogleLocations: a country-word entry is not treated as a city", () => {
  // "United Kingdom" is country-wide, so it falls through to the region location.
  assert.deepEqual(pickGoogleLocations(cfg(["United Kingdom"], ["uk"])), ["United Kingdom"]);
});

test("pickGoogleLocations: no city -> one location per region", () => {
  assert.deepEqual(pickGoogleLocations(cfg([], ["uk", "dubai"])), [
    "United Kingdom",
    "Dubai, United Arab Emirates",
  ]);
});

test("pickGoogleLocations: nothing set -> configured source location, else worldwide", () => {
  assert.deepEqual(pickGoogleLocations(cfg([], [], "Singapore")), ["Singapore"]);
  assert.deepEqual(pickGoogleLocations(cfg([], [])), [undefined]);
});
