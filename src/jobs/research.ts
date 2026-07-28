/**
 * Pull a short, human-readable phrase from a job posting that shows the letter
 * was written for THIS company — their mission, what they build, who they help.
 * No AI: high-precision regex patterns over the (already HTML-stripped) text.
 * Returns undefined when nothing clean is found, so callers fall back gracefully.
 */

// Each rule captures a clause and wraps it into a ready-to-drop-in phrase.
const RULES: { re: RegExp; phrase: (clause: string) => string }[] = [
  { re: /\bmission(?:\s+is)?\s+to\s+([^.!?\n]{10,90})/i, phrase: (c) => `your mission to ${c}` },
  { re: /\b(?:vision|purpose)(?:\s+is)?\s+to\s+([^.!?\n]{10,90})/i, phrase: (c) => `your goal to ${c}` },
  { re: /\bwe(?:'re|\s+are)\s+on\s+a\s+mission\s+to\s+([^.!?\n]{10,90})/i, phrase: (c) => `your mission to ${c}` },
  { re: /\bwe(?:'re|\s+are)\s+building\s+([^.!?\n]{10,90})/i, phrase: (c) => `what you're building — ${c}` },
  { re: /\bcommitted\s+to\s+([^.!?\n]{10,90})/i, phrase: (c) => `your commitment to ${c}` },
  { re: /\bdedicated\s+to\s+([^.!?\n]{10,90})/i, phrase: (c) => `your dedication to ${c}` },
  { re: /\bwe\s+help\s+([^.!?\n]{10,90})/i, phrase: (c) => `the way you help ${c}` },
  { re: /\bpassionate\s+about\s+([^.!?\n]{10,90})/i, phrase: (c) => `your focus on ${c}` },
];

// Clauses containing these read like job-ad boilerplate, not a mission — skip.
// (No trailing \b so plurals like "requirements"/"responsibilities" still match.)
const BOILERPLATE = /\b(responsibilit|requirement|apply|salary|benefit|\bcv\b|resume|equal opportunit|£|\$|€|years? of experience)/i;

/** Trim a captured clause to a clean, self-contained fragment. */
function cleanClause(raw: string): string | undefined {
  let c = raw.trim().replace(/\s+/g, " ");
  // Cut at the first list break OR sentence-continuation so we don't trail into
  // a second thought ("...help each other — is a tall order").
  c = c.split(/[,;:]| — | – | - | is | are | but | which | while | so /)[0].trim();
  // Drop a dangling connective at the end ("build great products and").
  c = c.replace(/\s+(and|or|to|for|with|the|a|of|that|which|by)$/i, "").trim();
  if (c.length < 8 || c.length > 60) return undefined;
  if (BOILERPLATE.test(c)) return undefined;
  return c;
}

/**
 * Best mission-ish phrase from the posting, e.g. "your mission to widen access
 * to legal advice". Undefined when the text yields nothing clean.
 */
export function extractResearchPhrase(description: string): string | undefined {
  if (!description) return undefined;
  for (const { re, phrase } of RULES) {
    const m = description.match(re);
    const clause = m && cleanClause(m[1]);
    if (clause) return phrase(clause);
  }
  return undefined;
}
