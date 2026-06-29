/**
 * Live smoke test for the keyless sources — hits real APIs, so it's NOT part of
 * `npm test` (which must pass offline). Run it manually to confirm the boards
 * still respond and map cleanly:  npm run test:live
 *
 * Exits non-zero if every keyless source returns nothing (a sign something broke
 * upstream or in our mappers). Individual sources are allowed to be flaky.
 */
import { loadConfig, loadEnv } from "../src/jobs/config.ts";
import { ALL_SOURCES } from "../src/jobs/sources/index.ts";
import type { AppConfig } from "../src/jobs/types.ts";

// Self-contained config so this doesn't depend on the user's saved profile.
const config: AppConfig = {
  profile: { name: "Test", email: "test@example.com", summary: "", skills: [], experience: [], education: [] },
  search: {
    keywords: ["software engineer", "legal counsel"],
    regions: ["global"],
    locations: [],
    remoteOnly: false,
    minScore: 0,
  },
  sources: {
    remotive: { enabled: true },
    remoteok: { enabled: true },
    arbeitnow: { enabled: true },
    jobicy: { enabled: true },
    himalayas: { enabled: true },
    themuse: { enabled: true },
    customfeeds: { urls: ["https://weworkremotely.com/remote-jobs.rss"] },
  },
};

const KEYLESS = ["remotive", "remoteok", "arbeitnow", "jobicy", "himalayas", "themuse", "customfeeds"];

async function main() {
  loadEnv();
  try {
    // Surface .env-keyed sources if the user has them configured, but never require them.
    loadConfig();
  } catch {
    /* fine — we use the inline config above */
  }

  let totalOk = 0;
  const results: { name: string; count: number; ok: boolean; note: string }[] = [];

  for (const source of ALL_SOURCES) {
    if (!KEYLESS.includes(source.name)) continue;
    if (!source.isEnabled(config)) {
      results.push({ name: source.name, count: 0, ok: true, note: "disabled (skipped)" });
      continue;
    }
    try {
      const jobs = await source.fetch(config);
      // Sanity-check the shape of the first job, not just the count.
      const sample = jobs[0];
      const wellFormed = !sample || (typeof sample.title === "string" && typeof sample.url === "string");
      const ok = wellFormed;
      if (ok && jobs.length > 0) totalOk++;
      results.push({
        name: source.name,
        count: jobs.length,
        ok,
        note: sample ? `e.g. "${sample.title?.slice(0, 50)}"` : "no rows",
      });
    } catch (err) {
      results.push({ name: source.name, count: 0, ok: false, note: (err as Error).message });
    }
  }

  console.log("\nLive source smoke test (keyless):\n");
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`  ${mark} ${r.name.padEnd(12)} ${String(r.count).padStart(4)} jobs  ${r.note}`);
  }
  console.log(`\n${totalOk}/${KEYLESS.length} keyless sources returned well-formed jobs.`);

  if (totalOk === 0) {
    console.error("\nFAIL: no keyless source returned data — check network or upstream APIs.");
    process.exit(1);
  }
  console.log("OK\n");
}

main();
