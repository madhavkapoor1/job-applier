/**
 * Mass-apply (queue mode): generate tailored materials for the best-matching
 * jobs that haven't been queued/applied yet, and add them to the review queue.
 *
 *   npm run apply                 # queue top 20 by score
 *   npm run apply -- --limit 50   # queue more
 *   npm run apply -- --min 30     # only jobs scoring >= 30
 *   npm run apply -- --all        # queue everything not yet handled
 */
import { loadConfig } from "../src/jobs/config.ts";
import { allJobs, getApplication, getJob } from "../src/jobs/store.ts";
import { queueJobs } from "../src/jobs/pipeline.ts";
import { buildReviewPage } from "../src/jobs/review.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function main() {
  const config = loadConfig();
  const limit = hasFlag("all") ? Infinity : Number(arg("limit") ?? 20);
  const min = Number(arg("min") ?? config.search.minScore ?? 0);

  const candidates = allJobs()
    .filter((j) => j.score >= min)
    .filter((j) => !getApplication(j.id)) // skip already-handled
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!candidates.length) {
    console.log("No new candidates to queue. Run `npm run discover` first, or lower --min.");
    return;
  }

  const { queued, errors } = queueJobs(candidates, config);
  for (const app of queued) {
    const job = getJob(app.jobId);
    console.log(`  queued [${job?.score ?? "?"}] ${job?.title} — ${job?.company}`);
  }
  for (const e of errors) console.warn(`  ERROR ${e.title}: ${e.error}`);

  const review = buildReviewPage();
  console.log(`\nQueued ${queued.length} application(s).`);
  console.log(`Review page: ${review.path}`);
  console.log("Open it in a browser to apply, or run `npm run list` for the CLI view.");
}

main();
