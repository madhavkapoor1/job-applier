/**
 * Discover jobs: fan out across all enabled sources, normalize, dedupe,
 * score against the profile, filter, and persist to data/db.json.
 *
 *   npm run discover
 */
import { loadConfig, loadEnv } from "../src/jobs/config.ts";
import { runDiscovery } from "../src/jobs/pipeline.ts";
import { applyCliProfileArg } from "../src/jobs/profiles.ts";

async function main() {
  applyCliProfileArg(); // --profile <name> targets another person's data
  loadEnv();
  const config = loadConfig();

  const { summary, jobs } = await runDiscovery(config);

  console.log(`Sources enabled: ${summary.enabled.join(", ") || "(none)"}`);
  if (summary.skipped.length)
    console.log(`Sources skipped (disabled/no key): ${summary.skipped.join(", ")}`);
  console.log("");
  for (const [name, count] of Object.entries(summary.perSource)) {
    console.log(
      count < 0
        ? `  ${name}: FAILED — ${summary.errors[name] ?? "unknown error"}`
        : `  ${name}: ${count} postings`,
    );
  }

  console.log("");
  console.log(
    `Fetched ${summary.fetched} → ${summary.unique} unique → ${summary.kept} passed filters.`,
  );
  console.log(`Stored: ${summary.added} new, ${summary.updated} refreshed.`);
  if (jobs.length) {
    console.log("\nTop matches:");
    for (const j of jobs.slice(0, 10)) {
      console.log(`  [${String(j.score).padStart(3)}] ${j.title} — ${j.company} (${j.source})`);
    }
    console.log("\nNext: `npm run apply` to generate materials for the top matches.");
  }
}

main().catch((err) => {
  console.error("discover failed:", err.message);
  process.exit(1);
});
