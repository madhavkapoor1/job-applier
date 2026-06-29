import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLATE_DIR, DATA_DIR } from "./config.ts";
import type { Job, Profile } from "./types.ts";

const APPLICATIONS_DIR = resolve(DATA_DIR, "applications");

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

  return {
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
    "job.company": job.company,
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
  const p = resolve(DATA_DIR, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

export interface GeneratedMaterials {
  resumePath: string; // relative to data dir
  coverLetterPath: string;
}

/** Render resume + cover letter for a job and write them under data/applications/<id>/. */
export function generateMaterials(job: Job, profile: Profile): GeneratedMaterials {
  const ctx = buildContext(job, profile);
  const resume = render(loadTemplate("resume.md"), ctx);
  const cover = render(loadTemplate("cover-letter.md"), ctx);

  const dir = resolve(APPLICATIONS_DIR, job.id);
  mkdirSync(dir, { recursive: true });
  const resumePath = resolve(dir, "resume.md");
  const coverPath = resolve(dir, "cover-letter.md");
  writeFileSync(resumePath, resume);
  writeFileSync(coverPath, cover);

  return {
    resumePath: `applications/${job.id}/resume.md`,
    coverLetterPath: `applications/${job.id}/cover-letter.md`,
  };
}
