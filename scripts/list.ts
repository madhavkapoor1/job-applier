/**
 * List jobs / the application queue.
 *
 *   npm run list                  # queued applications (the review queue)
 *   npm run list -- --status all  # everything
 *   npm run list -- --jobs        # all discovered jobs by score
 *   npm run list -- --status applied
 */
import { allApplications, allJobs, getJob } from "../src/jobs/store.ts";
import { applyCliProfileArg } from "../src/jobs/profiles.ts";
import type { ApplicationStatus } from "../src/jobs/types.ts";

applyCliProfileArg(); // --profile <name> targets another person's data

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  if (process.argv.includes("--jobs")) {
    const jobs = allJobs().sort((a, b) => b.score - a.score);
    console.log(`${jobs.length} discovered jobs:\n`);
    for (const j of jobs) {
      console.log(`[${String(j.score).padStart(3)}] ${j.title} — ${j.company} · ${j.location} (${j.source})`);
      console.log(`      ${j.id}  ${j.url}`);
    }
    return;
  }

  const status = (arg("status") ?? "queued") as ApplicationStatus | "all";
  const apps = allApplications()
    .filter((a) => status === "all" || a.status === status)
    .sort((a, b) => (getJob(b.jobId)?.score ?? 0) - (getJob(a.jobId)?.score ?? 0));

  if (!apps.length) {
    console.log(`No applications with status "${status}".`);
    return;
  }

  console.log(`${apps.length} application(s) [${status}]:\n`);
  for (const a of apps) {
    const j = getJob(a.jobId);
    if (!j) continue;
    console.log(`[${String(j.score).padStart(3)}] ${a.status.toUpperCase().padEnd(7)} ${j.title} — ${j.company}`);
    console.log(`      apply: ${j.url}`);
    console.log(`      id:    ${j.id}${a.note ? `  note: ${a.note}` : ""}`);
  }
}

main();
