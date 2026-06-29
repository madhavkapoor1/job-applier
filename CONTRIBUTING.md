# Contributing

Thanks for improving job-applier! The most common contribution is **adding a new job source**.
Before writing code, check whether you even need to:

## Can you avoid code? (often yes)

- **A company you want to follow** that uses Greenhouse / Lever / Ashby / Workable → just add its
  handle in the **Profile** tab (or the `sources.<ats>.companies` array in config). No code.
- **Any board that publishes an RSS/Atom feed** → paste its feed URL into **"Add any job board by
  feed URL"** in the Profile tab (or `sources.customfeeds.urls`). No code. This covers a large
  share of niche, country-specific, and company-career boards.

Only write a coded source when the board has a **bespoke JSON API** (its own response shape, auth,
or pagination) that the generic feed reader can't consume.

## Adding a coded source

Every source implements the `JobSource` interface (`src/jobs/types.ts`):

```ts
export interface JobSource {
  name: string;
  isEnabled(config: AppConfig): boolean;
  fetch(config: AppConfig): Promise<RawJob[]>;
}
```

The pipeline does the rest — **normalization, HTML stripping, dedupe, scoring, keyword filtering,
and persistence are all central.** Your source only fetches and maps to `RawJob`.

### 1. Create `src/jobs/sources/yourboard.ts`

```ts
import { fetchJson } from "../http.ts";
import { env } from "../config.ts";
import type { AppConfig, JobSource, RawJob } from "../types.ts";

export const yourboard: JobSource = {
  name: "yourboard",
  // Keyless source: on unless explicitly disabled.
  isEnabled: (c) => c.sources.yourboard?.enabled !== false,
  // Keyed source instead? Gate on the key so the pipeline skips it silently:
  //   isEnabled: (c) => c.sources.yourboard?.enabled === true && !!env("YOURBOARD_KEY"),
  async fetch(config: AppConfig): Promise<RawJob[]> {
    try {
      const data = await fetchJson<{ jobs?: RawApiJob[] }>(
        `https://api.yourboard.com/jobs?q=${encodeURIComponent(config.search.keywords.join(" "))}`,
      );
      return (data.jobs ?? []).map((j) => ({
        source: "yourboard",
        sourceId: String(j.id),
        title: j.title,
        company: j.company ?? "Unknown",
        location: j.location ?? "",
        url: j.applyUrl,           // required — jobs with no url are dropped
        description: j.description ?? "",
        remote: j.isRemote,        // optional; normalize infers it if omitted
        postedAt: j.postedAt,      // optional ISO date
      }));
    } catch (err) {
      console.warn(`  [yourboard]: ${(err as Error).message}`);
      return []; // never throw — a failing source must not break discovery
    }
  },
};
```

`RawJob` is `Job` minus the fields the pipeline fills in (`id`, `score`, `matchedKeywords`,
`discoveredAt`, and an inferred `remote`). See `src/jobs/types.ts`.

### 2. Register it in `src/jobs/sources/index.ts`

Import it and add it to `ALL_SOURCES`. That's the only wiring — it's now picked up by both the CLI
and the web app, and appears as a toggle in the UI.

### 3. Add its config type

In `SourcesConfig` (`src/jobs/types.ts`), add `yourboard?: { enabled: boolean }` (or whatever
options it needs). If it's user-toggleable in the web form, also thread it through
`ProfilePayload` + `mergeConfig` in `src/app/actions.ts` and the toggle list in
`src/app/ProfileForm.tsx`.

## Conventions

- **Imports use explicit `.ts` extensions** (`import { x } from "./y.ts"`).
- **Use `fetchJson` / `fetchText`** from `http.ts` — they add a browser User-Agent, timeout, and
  retries. Many boards 403 a bare Node request.
- **Never throw from `fetch`** — log and return `[]`. One bad source shouldn't sink a run.
- **Respect each board's terms** (rate limits, attribution, no scraping where disallowed). Sources
  that require scraping a site against its ToS won't be merged.
- **Country targeting:** if the board is per-country, read `config.search.regions` via the helpers
  in `src/jobs/regions.ts` (see `adzuna.ts` / `serpapi.ts`) rather than inventing your own.

## Testing

Unit tests live next to the code as `src/**/*.test.ts` (Node's built-in runner via tsx — no extra
deps). Pure logic should have a test; network code is checked live.

```bash
npm test                # unit suite (offline) — add tests for any pure logic you introduce
npm run test:live       # hits the live keyless APIs; add your source here if it's keyless
npm run discover        # runs every enabled source; check your board's line in the output
npx tsc --noEmit        # typecheck
```

If your source has pure mapping logic, factor it out (as `parseFeed` is in `customfeeds.ts`) and
unit-test it with inline sample payloads — no network in `npm test`. Then open a PR describing the
board, whether it needs a key, and roughly what coverage it adds.
