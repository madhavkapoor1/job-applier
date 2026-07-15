/**
 * (Re)build the static HTML review page for the current queue.
 *
 *   npm run review
 */
import { buildReviewPage } from "../src/jobs/review.ts";
import { applyCliProfileArg } from "../src/jobs/profiles.ts";

applyCliProfileArg(); // --profile <name> targets another person's data
const { path, count } = buildReviewPage();
console.log(`Built review page with ${count} queued application(s):`);
console.log(path);
