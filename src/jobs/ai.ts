/**
 * AI-tailored cover letters via the Anthropic API. Entirely optional: when no
 * ANTHROPIC_API_KEY is set (or the call fails), callers fall back to the
 * {{token}} template, so the app never depends on the network to queue jobs.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config.ts";
import type { Job, Profile } from "./types.ts";

const MODEL = "claude-sonnet-5";

/** True when AI-tailored cover letters are available. */
export function aiEnabled(): boolean {
  return !!env("ANTHROPIC_API_KEY");
}

function profileSummary(profile: Profile): string {
  const lines = [
    `Name: ${profile.name}`,
    profile.location ? `Location: ${profile.location}` : "",
    `Summary: ${profile.summary}`,
    `Skills: ${profile.skills.join(", ")}`,
    "",
    "Experience:",
    ...profile.experience.map((e) => {
      const bullets = e.bullets.map((b) => `    - ${b}`).join("\n");
      return `  ${e.title}, ${e.company} (${e.start}–${e.end})${bullets ? "\n" + bullets : ""}`;
    }),
    "",
    "Education:",
    ...profile.education.map((e) => `  ${e.degree}, ${e.school} (${e.year})`),
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Write a cover letter tailored to this specific job, or undefined when AI is
 * unavailable or the request fails (callers use the template instead).
 */
export async function aiCoverLetter(job: Job, profile: Profile): Promise<string | undefined> {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return undefined;

  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const description = job.description.slice(0, 6000);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      system:
        "You write concise, professional cover letters for job applications. " +
        "Use only facts provided about the candidate — never invent employers, qualifications, dates, or achievements. " +
        "Match the tone and conventions of the job's market (e.g. UK roles get UK English and conventions). " +
        "Output plain text only: no markdown, no placeholders, no commentary before or after the letter.",
      messages: [
        {
          role: "user",
          content:
            `Write a cover letter (250-320 words) from this candidate for this job.\n\n` +
            `# Candidate\n${profileSummary(profile)}\n\n` +
            `# Job\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n` +
            `Description:\n${description}\n\n` +
            `Start with today's greeting to the hiring team, connect the candidate's real experience to what ` +
            `this specific role asks for, and sign off with the candidate's name. If the description is thin, ` +
            `lean on the job title and the candidate's strengths rather than guessing details.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || undefined;
  } catch (err) {
    // Never block queueing on an API hiccup — the template letter still works.
    console.warn(`  [ai] cover letter for "${job.title}" failed: ${(err as Error).message}`);
    return undefined;
  }
}
