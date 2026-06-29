/**
 * (Re)build the static HTML review page for the current queue.
 *
 *   npm run review
 */
import { buildReviewPage } from "../src/jobs/review.ts";

const { path, count } = buildReviewPage();
console.log(`Built review page with ${count} queued application(s):`);
console.log(path);
