/**
 * Mark an application's status after you've acted on it.
 *
 *   npm run mark -- <jobId> applied
 *   npm run mark -- <jobId> skipped "not enough remote flexibility"
 */
import { setStatus, getJob } from "../src/jobs/store.ts";
import { buildReviewPage } from "../src/jobs/review.ts";
import type { ApplicationStatus } from "../src/jobs/types.ts";

const VALID: ApplicationStatus[] = ["queued", "applied", "skipped", "error"];

function main() {
  const [, , jobId, status, ...noteParts] = process.argv;
  if (!jobId || !status) {
    console.error("Usage: npm run mark -- <jobId> <queued|applied|skipped> [note]");
    process.exit(1);
  }
  if (!VALID.includes(status as ApplicationStatus)) {
    console.error(`Invalid status "${status}". Use one of: ${VALID.join(", ")}`);
    process.exit(1);
  }

  const note = noteParts.join(" ") || undefined;
  const ok = setStatus(jobId, status as ApplicationStatus, note);
  if (!ok) {
    console.error(`No application found for job id "${jobId}". Run \`npm run list\` to see ids.`);
    process.exit(1);
  }

  const job = getJob(jobId);
  console.log(`Marked ${status}: ${job?.title ?? jobId}${note ? ` (${note})` : ""}`);
  buildReviewPage(); // keep the review page in sync
}

main();
