/**
 * "Assisted apply": open a real application form in a visible browser with the
 * standard identity fields + CV pre-filled, then hand control to the user to
 * answer any custom questions, pass the CAPTCHA, and click Submit themselves.
 *
 * We deliberately never submit — Greenhouse forms carry required judgment
 * questions ("UK Right to Work?") and a reCAPTCHA, so a human must finish.
 */
import { chromium, type Page } from "playwright";
import { existsSync } from "node:fs";
import type { Job, Profile } from "./types.ts";

/** Fill the standard Greenhouse fields and attach the CV. Best-effort: any field
 *  that isn't present is silently skipped, so it's safe on non-Greenhouse forms. */
export async function fillApplication(
  page: Page,
  profile: Profile,
  resumeAbs?: string,
  coverAbs?: string,
): Promise<string[]> {
  const filled: string[] = [];

  const fill = async (selector: string, value: string | undefined, label: string) => {
    if (!value) return;
    const loc = page.locator(selector).first();
    if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
      try {
        await loc.fill(value, { timeout: 4000 });
        filled.push(label);
      } catch {
        /* leave for the user */
      }
    }
  };

  const parts = (profile.name || "").trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;

  await fill("#first_name", first, "first name");
  await fill("#last_name", last, "last name");
  await fill("#email", profile.email, "email");
  await fill("#phone", profile.phone, "phone");
  await fill("#candidate-location", profile.location, "location");

  const attach = async (selector: string, file: string | undefined, label: string) => {
    if (!file || !existsSync(file)) return;
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      try {
        await loc.setInputFiles(file, { timeout: 6000 });
        filled.push(label);
      } catch {
        /* leave for the user */
      }
    }
  };

  await attach("#resume", resumeAbs, "CV");
  await attach("#cover_letter", coverAbs, "cover letter");

  return filled;
}

/** Launch a visible browser at the job's application page, pre-fill, and leave it open.
 *  resumeAbs/coverAbs are absolute file paths. */
export async function assistedApply(
  job: Job,
  profile: Profile,
  resumeAbs?: string,
  coverAbs?: string,
): Promise<{ filled: string[] }> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
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

  const filled = await fillApplication(page, profile, resumeAbs, coverAbs);

  // Intentionally do NOT close the browser — the user finishes and submits.
  return { filled };
}
