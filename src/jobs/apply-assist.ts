/**
 * "Assisted apply": open a real application form in a visible browser with the
 * standard identity fields + CV pre-filled, then hand control to the user to
 * answer any custom questions, pass the CAPTCHA, and click Submit themselves.
 *
 * We deliberately never submit — application forms carry required judgment
 * questions ("Right to Work?") and reCAPTCHAs, so a human must finish. The
 * fillers are per-ATS but always best-effort: any field that isn't present is
 * silently skipped, so a form we don't fully recognise still opens ready to go.
 */
import { chromium, type Browser, type Page } from "playwright";
import { existsSync } from "node:fs";
import { atsFromUrl, type AtsKind } from "./source-meta.ts";
import type { Job, Profile } from "./types.ts";

/** Candidate selectors per logical field, tried in order until one fills. */
interface FieldMap {
  fullName?: string[];
  firstName?: string[];
  lastName?: string[];
  email?: string[];
  phone?: string[];
  location?: string[];
  resume?: string[];
  cover?: string[];
}

// Generic selectors tried for every form, ahead of the ATS-specific ones below.
const GENERIC: FieldMap = {
  fullName: ['input[name="name" i]', 'input[id="name" i]', 'input[autocomplete="name"]'],
  firstName: ['input[name*="first" i]', 'input[id*="first" i]', 'input[autocomplete="given-name"]'],
  lastName: ['input[name*="last" i]', 'input[id*="last" i]', 'input[autocomplete="family-name"]'],
  email: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]'],
  phone: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]'],
  location: ['input[name*="location" i]', 'input[id*="location" i]', 'input[name*="city" i]'],
  resume: ['input[type="file"][name*="resume" i]', 'input[type="file"][id*="resume" i]', 'input[type="file"][name*="cv" i]'],
  cover: ['input[type="file"][name*="cover" i]', 'input[type="file"][id*="cover" i]'],
};

const ATS_FIELDS: Record<AtsKind, FieldMap> = {
  greenhouse: {
    firstName: ["#first_name"],
    lastName: ["#last_name"],
    email: ["#email"],
    phone: ["#phone"],
    location: ["#candidate-location", "#job_application_location"],
    resume: ["#resume", 'input[type="file"][id*="resume" i]'],
    cover: ["#cover_letter"],
  },
  lever: {
    fullName: ['input[name="name"]'],
    email: ['input[name="email"]'],
    phone: ['input[name="phone"]'],
    location: ['input[name="location"]'],
    resume: ['input[name="resume"]', 'input[type="file"]'],
  },
  ashby: {
    fullName: ['input[name="_systemfield_name"]', 'input[aria-label*="name" i]'],
    email: ['input[name="_systemfield_email"]', 'input[type="email"]'],
    phone: ['input[name="_systemfield_phone"]', 'input[type="tel"]'],
    resume: ['input[type="file"]'],
  },
  workable: {
    firstName: ['input[name="firstname"]', "#firstname"],
    lastName: ['input[name="lastname"]', "#lastname"],
    email: ['input[name="email"]', "#email"],
    phone: ['input[name="phone"]', "#phone"],
    resume: ['input[type="file"][name*="resume" i]', 'input[type="file"]'],
  },
};

function mergeMaps(a: FieldMap, b: FieldMap): FieldMap {
  const out: FieldMap = {};
  for (const key of Object.keys({ ...a, ...b }) as (keyof FieldMap)[]) {
    out[key] = [...(b[key] ?? []), ...(a[key] ?? [])]; // ATS-specific first, generic fallback
  }
  return out;
}

async function fillFirst(page: Page, selectors: string[] | undefined, value: string): Promise<boolean> {
  if (!value) return false;
  for (const sel of selectors ?? []) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
      try {
        await loc.fill(value, { timeout: 3000 });
        return true;
      } catch {
        /* try next candidate */
      }
    }
  }
  return false;
}

async function attachFirst(page: Page, selectors: string[] | undefined, file: string | undefined): Promise<boolean> {
  if (!file || !existsSync(file)) return false;
  for (const sel of selectors ?? []) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      try {
        await loc.setInputFiles(file, { timeout: 5000 });
        return true;
      } catch {
        /* try next candidate */
      }
    }
  }
  return false;
}

/** Fill the standard identity fields + attach the CV, returning what stuck. */
export async function fillApplication(
  page: Page,
  profile: Profile,
  resumeAbs?: string,
  coverAbs?: string,
  url = "",
): Promise<string[]> {
  const filled: string[] = [];
  const ats = atsFromUrl(url);
  const map = ats ? mergeMaps(GENERIC, ATS_FIELDS[ats]) : GENERIC;

  const parts = (profile.name || "").trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;

  // Prefer a single full-name field; fall back to first/last.
  if (await fillFirst(page, map.fullName, profile.name)) filled.push("name");
  else {
    if (await fillFirst(page, map.firstName, first)) filled.push("first name");
    if (await fillFirst(page, map.lastName, last)) filled.push("last name");
  }
  if (await fillFirst(page, map.email, profile.email)) filled.push("email");
  if (profile.phone && (await fillFirst(page, map.phone, profile.phone))) filled.push("phone");
  if (profile.location && (await fillFirst(page, map.location, profile.location))) filled.push("location");
  if (await attachFirst(page, map.resume, resumeAbs)) filled.push("CV");
  if (await attachFirst(page, map.cover, coverAbs)) filled.push("cover letter");

  return filled;
}

/** Open one job's form in `page`, reveal it if hidden, and pre-fill it. */
async function prefillPage(
  page: Page,
  job: Job,
  profile: Profile,
  resumeAbs?: string,
  coverAbs?: string,
): Promise<string[]> {
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Reveal the form if it's behind an "Apply" button.
  const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
  if (await applyBtn.count()) {
    try {
      await applyBtn.click({ timeout: 3000 });
    } catch {
      /* form may already be visible */
    }
  }
  await page.waitForTimeout(1200);
  return fillApplication(page, profile, resumeAbs, coverAbs, job.url);
}

/** Launch a visible browser at the job's application page, pre-fill, and leave it open. */
export async function assistedApply(
  job: Job,
  profile: Profile,
  resumeAbs?: string,
  coverAbs?: string,
): Promise<{ filled: string[] }> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const filled = await prefillPage(page, job, profile, resumeAbs, coverAbs);
  // Intentionally do NOT close the browser — the user finishes and submits.
  return { filled };
}

export interface BatchApplyItem {
  job: Job;
  resumeAbs?: string;
  coverAbs?: string;
}
export interface BatchApplyResult {
  jobId: string;
  title: string;
  ok: boolean;
  filled: string[];
  error?: string;
}

/**
 * Open several jobs at once in ONE visible browser window — each in its own tab,
 * each pre-filled — so the user can tab through, finish, and submit them in a
 * few minutes. One shared window (not one per job) keeps it manageable; the user
 * closes the window when done. Tabs open sequentially so forms load reliably.
 */
export async function assistedApplyBatch(
  items: BatchApplyItem[],
  profile: Profile,
): Promise<BatchApplyResult[]> {
  const browser: Browser = await chromium.launch({ headless: false });
  const results: BatchApplyResult[] = [];
  for (const { job, resumeAbs, coverAbs } of items) {
    try {
      const page = await browser.newPage();
      const filled = await prefillPage(page, job, profile, resumeAbs, coverAbs);
      results.push({ jobId: job.id, title: job.title, ok: true, filled });
    } catch (err) {
      results.push({ jobId: job.id, title: job.title, ok: false, filled: [], error: (err as Error).message });
    }
  }
  // Leave the window open with every tab ready for the user to submit.
  return results;
}
