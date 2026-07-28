import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLATE_DIR, dataDir } from "./config.ts";
import { aiCoverLetter } from "./ai.ts";
import { extractResearchPhrase } from "./research.ts";
import type { Job, Profile } from "./types.ts";

function applicationsDir(): string {
  return resolve(dataDir(), "applications");
}

/** Lowercase the first letter (so an experience bullet reads mid-sentence). */
function lcFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Capitalise a company name that a source stored lowercase ("trustpilot" → "Trustpilot"). */
function displayCompany(name: string): string {
  const n = (name || "").trim();
  return n ? n[0].toUpperCase() + n.slice(1) : "your team";
}

/** Join into readable prose: ["A","B","C"] → "A, B and C". */
function proseList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Skills to name in the letter: the profile skills relevant to this posting, in their
 *  original casing (so "AI" doesn't become "ai"); fall back to the first few skills. */
function relevantSkills(job: Job, profile: Profile): string[] {
  const matched = new Set(job.matchedKeywords.map((k) => k.toLowerCase()));
  const relevant = profile.skills.filter((s) => matched.has(s.toLowerCase()));
  return (relevant.length >= 2 ? relevant : profile.skills).slice(0, 4);
}

/** The first sentence of a bullet, only if it's short enough to read mid-paragraph. */
function shortBullet(bullet: string | undefined): string {
  if (!bullet) return "";
  const sentence = bullet.split(/\.\s/)[0].replace(/[.!]+$/, "").trim();
  return sentence && sentence.split(/\s+/).length <= 22 ? sentence : "";
}

/** Build the three cover-letter paragraphs (offline / template path). */
function coverParagraphs(job: Job, profile: Profile): { hook: string; contribution: string; closing: string } {
  const company = displayCompany(job.company);

  // Para 1 — why this company, grounded in a line from the posting when we find one.
  const phrase = extractResearchPhrase(job.description);
  const hook = phrase
    ? `I'm applying for the ${job.title} role at ${company}, and ${phrase} is exactly the kind of work I want to be part of.`
    : `I'm excited to apply for the ${job.title} role at ${company} — the focus of this role lines up closely with where I want to take my career.`;

  // Para 2 — contribution + the skills that actually matched this posting.
  const strengthList = proseList(relevantSkills(job, profile)) || "the areas this role calls for";
  const exp = profile.experience[0];
  const role = exp ? [exp.title, exp.company].filter(Boolean).join(" at ") : "";
  const detail = shortBullet(exp?.bullets[0]);
  let contribution: string;
  if (role && detail) {
    contribution = `I'd bring directly relevant strengths in ${strengthList}. As ${role}, I ${lcFirst(detail)} — and I'm confident I can do the same for ${company}.`;
  } else if (role) {
    contribution = `I'd bring directly relevant strengths in ${strengthList}, drawing on my experience as ${role}, and I'm confident I can contribute quickly to ${company}.`;
  } else {
    contribution = `I'd bring directly relevant strengths in ${strengthList}, and I'm confident I can contribute quickly to ${company}.`;
  }

  // Para 3 — short close.
  const closing = `I'd welcome the chance to discuss how I can help ${company}${
    profile.email ? `. You can reach me at ${profile.email}` : ""
  }. Thank you for your consideration.`;

  return { hook, contribution, closing };
}

/**
 * Build the flat token map fed to templates. Everything is a precomputed string,
 * so templates only need simple {{token}} substitution — no template engine.
 */
function buildContext(job: Job, profile: Profile): Record<string, string> {
  const matched = job.matchedKeywords.length
    ? job.matchedKeywords.join(", ")
    : profile.skills.slice(0, 8).join(", ");

  const experienceText = profile.experience
    .map((e) => {
      const header = `${e.title}, ${e.company} (${e.start}–${e.end})`;
      const bullets = e.bullets.map((b) => `  - ${b}`).join("\n");
      return bullets ? `${header}\n${bullets}` : header;
    })
    .join("\n\n");

  const educationText = profile.education
    .map((e) => `${e.degree}, ${e.school} (${e.year})`)
    .join("\n");

  // Skip empty link values so blank form fields never render "github: |" garbage.
  const links = Object.entries(profile.links ?? {})
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join(" | ");

  // Pre-joined contact line: only the fields the user actually filled in.
  const contact = [profile.location, profile.email, profile.phone]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");

  const cover = coverParagraphs(job, profile);

  return {
    "cover.hook": cover.hook,
    "cover.contribution": cover.contribution,
    "cover.closing": cover.closing,
    "profile.name": profile.name,
    "profile.email": profile.email,
    "profile.phone": profile.phone ?? "",
    "profile.location": profile.location ?? "",
    "profile.contact": contact,
    "profile.summary": profile.summary,
    "profile.skills": profile.skills.join(", "),
    "profile.links": links,
    "profile.experience": experienceText,
    "profile.education": educationText,
    "job.title": job.title,
    "job.company": displayCompany(job.company),
    "job.location": job.location,
    "job.url": job.url,
    "job.source": job.source,
    "job.matchedKeywords": matched,
    "job.score": String(job.score),
    date: new Date().toISOString().slice(0, 10),
  };
}

/** Replace {{token}} with context values; unknown tokens become "". */
function render(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => ctx[key] ?? "");
}

function loadTemplate(name: string): string {
  const path = resolve(TEMPLATE_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`Template missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

/** Read a generated material by its data-dir-relative path ("" if absent). */
export function readMaterial(rel?: string): string {
  if (!rel) return "";
  const p = resolve(dataDir(), rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

export interface GeneratedMaterials {
  resumePath: string; // relative to data dir
  coverLetterPath: string;
}

/**
 * Render resume + cover letter for a job and write them under
 * <profile>/applications/<id>/. When an Anthropic key is configured, the cover
 * letter is AI-written for this specific job; the {{token}} template is the
 * offline fallback (and always used for the resume).
 */
export async function generateMaterials(job: Job, profile: Profile): Promise<GeneratedMaterials> {
  const ctx = buildContext(job, profile);
  const resume = render(loadTemplate("resume.md"), ctx);
  const cover =
    (await aiCoverLetter(job, profile)) ?? render(loadTemplate("cover-letter.md"), ctx);

  const dir = resolve(applicationsDir(), job.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "resume.md"), resume);
  writeFileSync(resolve(dir, "cover-letter.md"), cover);

  return {
    resumePath: `applications/${job.id}/resume.md`,
    coverLetterPath: `applications/${job.id}/cover-letter.md`,
  };
}
