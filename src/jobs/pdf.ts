/** Render generated Markdown materials to PDF (for upload to application forms). */
import { chromium } from "playwright";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { dataDir } from "./config.ts";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s: string) =>
  escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Minimal Markdown → HTML for our own templates (headings, lists, quotes, paragraphs). */
function mdToHtml(md: string): string {
  const out: string[] = [];
  for (const block of md.split(/\n{2,}/)) {
    const b = block.trimEnd();
    if (!b.trim()) continue;
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push("<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ""))}</li>`).join("") + "</ul>");
    } else if (/^##\s+/.test(b)) {
      out.push(`<h2>${inline(b.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(b)) {
      out.push(`<h1>${inline(b.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^>\s+/.test(b)) {
      out.push(`<blockquote>${inline(b.replace(/^>\s*/gm, ""))}</blockquote>`);
    } else {
      out.push(`<p>${lines.map(inline).join("<br/>")}</p>`);
    }
  }
  return out.join("\n");
}

function wrapHtml(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font: 13px/1.55 -apple-system, "Segoe UI", Arial, sans-serif; color: #111; max-width: 740px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 2px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 18px 0 8px; }
    blockquote { color: #555; font-style: italic; margin: 8px 0; padding: 0; border: 0; }
    ul { margin: 4px 0 4px 18px; padding: 0; } li { margin: 3px 0; }
    p { margin: 6px 0; } strong { font-weight: 600; }
  </style></head><body>${bodyHtml}</body></html>`;
}

/** Render a Markdown string to a PDF file. */
export async function renderPdf(markdown: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(wrapHtml(mdToHtml(markdown)), { waitUntil: "load" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "15mm", right: "15mm" },
    });
  } finally {
    await browser.close();
  }
}

/**
 * Ensure PDF versions of an application's materials exist (generated lazily,
 * since PDF rendering spins up Chromium). Returns their data-dir-relative paths.
 */
export async function ensureApplicationPdfs(
  resumeRel?: string,
  coverRel?: string,
): Promise<{ resumePdf?: string; coverPdf?: string }> {
  const result: { resumePdf?: string; coverPdf?: string } = {};
  if (resumeRel) result.resumePdf = await ensureOne(resumeRel);
  if (coverRel) result.coverPdf = await ensureOne(coverRel);
  return result;
}

async function ensureOne(rel: string): Promise<string | undefined> {
  const mdPath = resolve(dataDir(), rel);
  const pdfRel = rel.replace(/\.md$/, ".pdf");
  const pdfPath = resolve(dataDir(), pdfRel);
  if (!existsSync(mdPath)) return existsSync(pdfPath) ? pdfRel : undefined;
  // Re-render when the markdown is newer than the PDF, so a profile fix or
  // re-queue never uploads a stale CV/letter.
  if (existsSync(pdfPath) && statSync(pdfPath).mtimeMs >= statSync(mdPath).mtimeMs) {
    return pdfRel;
  }
  await renderPdf(readFileSync(mdPath, "utf8"), pdfPath);
  return pdfRel;
}
