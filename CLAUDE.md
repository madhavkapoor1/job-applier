# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The import above is load-bearing: this is **Next.js 16** with breaking changes from older
> versions. Read the relevant guide under `node_modules/next/dist/docs/01-app/` before writing or
> changing any Next.js code (pages, layouts, server actions, route handlers, config).

## What this is

A job-search / mass-apply tool with **two front-ends over one engine**:

- **CLI scripts** (`scripts/*.ts`, run via `tsx`) — for power users / automation.
- **Next.js web app** (`src/app/`) — a 3-step UI (Profile → Find Jobs → Review & Apply) for
  non-technical users.

Both call the same logic in **`src/jobs/`**. When adding behavior, put it in `src/jobs/` and have
both front-ends call it — do not duplicate logic in a script or a server action.

## Commands

```bash
# Web app
npm run dev            # dev server at http://localhost:3000
npm run build          # production build (also runs full tsc typecheck)
npm start              # serve the production build
npm run lint           # eslint

# CLI pipeline (run in order)
npm run discover                       # fetch + rank + store jobs
npm run apply -- --limit 20 --min 12   # generate materials, queue top matches (--all for everything)
npm run list -- --jobs                 # all discovered jobs; or --status queued|applied|skipped|all
npm run mark -- <jobId> applied "note" # set an application's status
npm run review                         # rebuild data/review.html from the queue

# Tests
npm test                # unit suite — Node's built-in runner via tsx, no extra deps, offline
npm run test:live       # opt-in: hits real APIs to confirm keyless sources still map (not in `npm test`)

# Typecheck without building
npx tsc --noEmit
```

**Tests** live next to the code as `src/**/*.test.ts`, using `node:test` + `node:assert` run through
tsx (`node --import tsx --test`). They cover the pure engine logic (`rank`, `regions`, `normalize`,
`locations`, the feed parser) and must pass offline — never add a network call to `npm test`; put
live-API checks in `scripts/smoke-sources.ts` (`npm run test:live`) instead. Sources that hit the
network aren't unit-tested; verify them with `npm run test:live` or `npm run discover`. `npm run
build` still runs a full tsc typecheck for web changes.

## Architecture

**Engine (`src/jobs/`)** — the discovery → rank → apply pipeline:

- `pipeline.ts` — `runDiscovery()` (fan out across sources, normalize, dedupe, score, filter,
  persist) and `queueJob()` (generate materials + save application). The single entry point both
  front-ends use.
- `sources/` — **pluggable** job sources. Each implements `JobSource` (`name`, `isEnabled`,
  `fetch → RawJob[]`) and is registered in `sources/index.ts` (`ALL_SOURCES`). To add a source,
  add a file and register it — normalization, dedupe, scoring, and storage are handled centrally,
  so a source only fetches and maps to `RawJob`. Keyed sources (`reed`, `adzuna`, `usajobs`,
  `serpapi`) return `false` from `isEnabled` when their env keys are missing, so the pipeline
  silently skips them; keyless sources (`themuse`, the ATS boards, etc.) just need company handles
  or are always on. **Currently configured for UK legal roles** — see `job-applier.config.json`.
- `normalize.ts` — `finalize()` assigns a stable `id` (sha1 of company|title|location, so re-runs
  and cross-source duplicates collapse), strips HTML, decodes entities, infers `remote`.
  `dedupe()` keeps the richest copy.
- `rank.ts` — `scoreJob()` is a transparent keyword heuristic (no AI): title hits weighted over
  body, plus remote/location/freshness. `passesFilters()` applies remote-only / excluded-title /
  min-score gates.
- `store.ts` — persistence is a single JSON file at `data/db.json` (`{ jobs, applications }`),
  keyed by job id. No database.
- `materials.ts` + `templates/*.md` — resume/cover letter via `{{token}}` substitution only
  (no template engine, no AI). Rendered per job into `data/applications/<jobId>/`.
- `config.ts` — loads/validates/saves `job-applier.config.json` (profile + search + sources).
  **Paths anchor to `process.cwd()`, not `import.meta.dirname`** — this is deliberate so the same
  files resolve correctly both under `tsx` (CLI) and inside Next's server bundle. `saveConfig()`
  is what the web form writes through, keeping CLI and web in sync.

**Web app (`src/app/`)** — thin layer over the engine:

- `page.tsx` is a server component (`export const dynamic = "force-dynamic"`) that calls
  `getDashboardState()` and hands it to the `Dashboard` client component.
- `dashboard.ts` (in `src/jobs/`, server-only — reads fs) builds the serializable `DashboardState`
  the UI renders, including the rendered materials text for the queue.
- `actions.ts` (`"use server"`) holds all mutations (`discoverAction`, `queueAction`, `markAction`,
  `saveProfileAction`). Each returns a fresh `DashboardState`; client components set it directly in
  React state rather than relying on router-cache revalidation.
- `ProfileForm` / `JobsPanel` / `QueuePanel` are client components; `components.tsx` holds shared
  styled bits. Styling is Tailwind v4 (already configured in `globals.css`).

## Conventions / gotchas

- **Runtime:** Node 24. TS runs via `tsx`. Imports use **explicit `.ts` extensions**
  (`allowImportingTsExtensions` in tsconfig) so scripts also work under plain Node type-stripping.
  Keep using `.ts` in import specifiers.
- **Env keys** load via `process.loadEnvFile()` from `.env` (see `.env.example`); never hard-code.
- **Personal data:** `data/` AND `job-applier.config.json` (the live config) are gitignored —
  both hold the user's personal details. `job-applier.config.example.json` is the committed
  template; `loadConfig()` falls back to it until the user saves a profile, and
  `isPlaceholderProfile()` (no saved config, or template strings) routes first-time web users to
  the Profile tab and blocks auto-prepare.
- **Store concurrency:** `store.ts` invalidates its in-process cache via db.json mtime so the CLI
  and web server can run simultaneously without clobbering each other — don't reintroduce a plain
  module-level cache. Use `saveApplications()`/`queueJobs()` for batches (one write), not loops of
  `saveApplication()`.
- **Locations:** `src/jobs/locations.ts` is the single interpretation of `search.locations`
  (cities vs. country-wide vs. remote). Sources must use `narrowCity()`/`parseLocations()` rather
  than reading `locations[0]` directly.
