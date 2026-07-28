import { test } from "node:test";
import assert from "node:assert/strict";
import { extractResearchPhrase } from "./research.ts";

test("extractResearchPhrase: pulls a mission clause", () => {
  const p = extractResearchPhrase("We're on a mission to widen access to legal advice for everyone.");
  assert.equal(p, "your mission to widen access to legal advice for everyone");
});

test("extractResearchPhrase: handles 'our mission is to'", () => {
  const p = extractResearchPhrase("About us. Our mission is to make healthcare simple. We are hiring.");
  assert.equal(p, "your mission to make healthcare simple");
});

test("extractResearchPhrase: 'committed to' and 'we help' variants", () => {
  assert.equal(
    extractResearchPhrase("We are committed to sustainable energy for all."),
    "your commitment to sustainable energy for all",
  );
  assert.equal(
    extractResearchPhrase("We help small businesses grow online."),
    "the way you help small businesses grow online",
  );
});

test("extractResearchPhrase: cuts at a list break", () => {
  const p = extractResearchPhrase("Our mission is to build great products for teachers, plus more.");
  assert.equal(p, "your mission to build great products for teachers");
});

test("extractResearchPhrase: cuts a run-on at ' is '", () => {
  const p = extractResearchPhrase("Our mission is to build tools everyone loves is our aim, honestly.");
  assert.equal(p, "your mission to build tools everyone loves");
});

test("extractResearchPhrase: cuts at an em-dash aside", () => {
  const p = extractResearchPhrase("We are committed to fairness — and to speed — above all.");
  assert.equal(p, "your commitment to fairness");
});

test("extractResearchPhrase: skips boilerplate and returns undefined", () => {
  assert.equal(extractResearchPhrase("You will be committed to meeting all requirements and responsibilities."), undefined);
  assert.equal(extractResearchPhrase(""), undefined);
  assert.equal(extractResearchPhrase("A generic paragraph with nothing mission-like in it at all."), undefined);
});

test("extractResearchPhrase: drops over-long clauses rather than trailing off", () => {
  const long = "Our mission is to " + "x".repeat(200) + ".";
  assert.equal(extractResearchPhrase(long), undefined);
});
