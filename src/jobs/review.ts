import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataDir } from "./config.ts";
import { allApplications, getJob } from "./store.ts";
import { readMaterial } from "./materials.ts";

const reviewPath = () => resolve(dataDir(), "review.html");

const esc = (s: string) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Build a self-contained, no-server HTML review page for the queued applications. */
export function buildReviewPage(): { path: string; count: number } {
  const queued = allApplications()
    .filter((a) => a.status === "queued")
    .map((a) => ({ app: a, job: getJob(a.jobId) }))
    .filter((x) => x.job)
    .sort((a, b) => (b.job!.score ?? 0) - (a.job!.score ?? 0));

  const cards = queued
    .map(({ app, job }, i) => {
      const resume = readMaterial(app.resumePath);
      const cover = readMaterial(app.coverLetterPath);
      return `
  <section class="card">
    <header>
      <span class="score">${job!.score}</span>
      <div>
        <h2>${esc(job!.title)}</h2>
        <p class="meta">${esc(job!.company)} · ${esc(job!.location)} · <span class="src">${esc(job!.source)}</span>${job!.remote ? ' · <span class="remote">remote</span>' : ""}</p>
        <p class="kw">${job!.matchedKeywords.map((k) => `<span>${esc(k)}</span>`).join("")}</p>
      </div>
      <a class="apply" href="${esc(job!.url)}" target="_blank" rel="noopener">Open &amp; Apply ↗</a>
    </header>
    <div class="materials">
      <div class="mat">
        <div class="mat-head"><strong>Cover letter</strong><button data-copy="cl-${i}">Copy</button></div>
        <pre id="cl-${i}">${esc(cover)}</pre>
      </div>
      <div class="mat">
        <div class="mat-head"><strong>Resume</strong><button data-copy="rs-${i}">Copy</button></div>
        <pre id="rs-${i}">${esc(resume)}</pre>
      </div>
    </div>
    <footer>
      <code>npm run mark -- ${job!.id} applied</code>
      <code>npm run mark -- ${job!.id} skipped</code>
    </footer>
  </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Application Review Queue (${queued.length})</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 920px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; }
  .card { border: 1px solid #8884; border-radius: 12px; padding: 16px; margin: 16px 0; }
  .card header { display: flex; gap: 14px; align-items: flex-start; }
  .score { font-weight: 700; font-size: 20px; background: #4f46e5; color: #fff; border-radius: 8px; padding: 6px 10px; }
  h2 { margin: 0; font-size: 18px; }
  .meta { margin: 4px 0; color: #888; font-size: 13px; }
  .src, .remote { text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
  .remote { color: #16a34a; }
  .kw { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .kw span { background: #4f46e522; border-radius: 6px; padding: 1px 7px; font-size: 12px; }
  .apply { margin-left: auto; white-space: nowrap; background: #16a34a; color: #fff; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; }
  .materials { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .mat-head { display: flex; justify-content: space-between; align-items: center; }
  pre { background: #8881; border-radius: 8px; padding: 10px; max-height: 280px; overflow: auto; white-space: pre-wrap; font-size: 12px; }
  button { cursor: pointer; border: 1px solid #8886; background: transparent; border-radius: 6px; padding: 2px 10px; }
  footer { margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
  code { background: #8881; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
  @media (max-width: 640px) { .materials { grid-template-columns: 1fr; } }
</style></head>
<body>
  <h1>Application Review Queue — ${queued.length} job${queued.length === 1 ? "" : "s"}</h1>
  <p>Click <strong>Open &amp; Apply</strong>, copy the materials into the form, then run the mark command shown under each card.</p>
  ${cards || "<p>Nothing queued. Run <code>npm run apply</code> first.</p>"}
<script>
  document.querySelectorAll("button[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const el = document.getElementById(b.dataset.copy);
      await navigator.clipboard.writeText(el.textContent);
      const t = b.textContent; b.textContent = "Copied!"; setTimeout(() => (b.textContent = t), 1200);
    });
  });
</script>
</body></html>`;

  const path = reviewPath();
  writeFileSync(path, html);
  return { path, count: queued.length };
}
