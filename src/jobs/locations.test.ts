import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocations, narrowCity } from "./locations.ts";

test("parseLocations: classifies remote / country / city markers", () => {
  const m = parseLocations(["London", "United Kingdom", "Remote"]);
  assert.deepEqual(m.cities, ["London"]);
  assert.equal(m.countryWide, true);
  assert.equal(m.remote, true);
});

test("parseLocations: cities only stays city-scoped", () => {
  const m = parseLocations(["London", "Manchester"]);
  assert.deepEqual(m.cities, ["London", "Manchester"]);
  assert.equal(m.countryWide, false);
  assert.equal(m.remote, false);
});

test("parseLocations: empty list means search everywhere", () => {
  const m = parseLocations([]);
  assert.equal(m.countryWide, true);
  assert.deepEqual(m.cities, []);
});

test("narrowCity: returns a city only when not country-wide", () => {
  assert.equal(narrowCity(["London"]), "London");
  assert.equal(narrowCity(["London", "United Kingdom"]), "", "country entry => no city narrowing");
  assert.equal(narrowCity(["Remote"]), "");
  assert.equal(narrowCity([]), "");
});
