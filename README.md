# job-applier

**Discover** jobs across many sources, **rank** them against your profile, and **apply** with
tailored materials — from a simple web app or the CLI. Free, runs entirely on your own computer,
no account required.

- **Web app** (no technical skills needed) — fill in a form, pick your countries, and get ranked
  jobs with ready-made cover letters. An optional *assisted apply* opens the application form in a
  browser with your details pre-filled.
- **CLI scripts** — the same engine for power users / automation.

Works **out of the box with zero setup** thanks to six keyless job boards, and scales up to
country-specific, all-industry coverage when you add a free API key or two.

> **The included example is configured for UK legal roles** (paralegal / compliance, broadening
> into ESG & legal-tech) — but nothing is field- or country-specific. Set your own keywords,
> countries, and skills in the **Profile** tab (or `job-applier.config.json`) and it retargets to
> any field, anywhere.

## Quick start

```bash
npm install
npm run dev          # then open http://localhost:3000
```

Then, in the browser:

1. **Profile** — your details, skills, the job keywords you want, and the **countries/regions** to
   search. Optionally upload your CV (PDF). Click *Save*.
2. **Find Jobs** — jobs appear ranked by fit (it auto-checks for fresh ones when you open the app).
   Click *Prepare application* on the ones you like.
3. **Review & Apply** — copy your tailored cover letter, or click *Assisted apply* to open the
   form pre-filled, finish any custom questions + CAPTCHA, and submit.

Everything is stored locally. Saving the profile creates `job-applier.config.json` (gitignored —
it holds your personal details); until then the app runs on the committed
`job-applier.config.example.json` template. The web form and CLI share the same config.

### Non-technical users (Mac / Windows)

No terminal needed. Build a self-contained package and send it to anyone:

```bash
npm run package      # produces job-applier-mac.tar.gz
```

The recipient unzips and double-clicks **`start-mac.command`** (macOS) or **`start-windows.bat`**
(Windows). First run downloads a private copy of Node + the browser (no admin password), then
opens the app. See `START-HERE-MAC.txt` in the package.

## Countries & regions

Pick any combination of **UK · Canada · India · Dubai/UAE · United States · Global/Remote** in the
Profile tab. Each region automatically points the job sources at the right place and gives
in-region roles a ranking boost. Semantics are **"country + remote/global"** — region is a ranking
nudge, never a hard filter, so remote and worldwide roles always stay eligible. See
`src/jobs/regions.ts`.

## Sources

Each source lives in `src/jobs/sources/` and is auto-discovered via `sources/index.ts`. A source
self-disables (logged, never fatal) when it lacks a key or config.

**Keyless — on by default, no setup:**

| Source | Coverage |
| --- | --- |
| `remotive` | Remote roles worldwide, many industries |
| `remoteok` | Large remote feed — eng, design, sales, support, HR, finance, legal |
| `arbeitnow` | Europe + remote, all industries |
| `jobicy` | Remote across many industries, matched to your keywords |
| `himalayas` | 80k+ live remote jobs, broad coverage |
| `themuse` | US & remote roles (category-configurable) |
| `hackernews` | Monthly "Who is hiring?" threads (off by default; tech-leaning) |
| `greenhouse` / `lever` / `ashby` / `workable` | Per-company ATS boards (optional — add company slugs) |

**Keyed — add a free key in `.env` for on-site & country-specific coverage:**

| Source | Key(s) | Notes |
| --- | --- | --- |
| `adzuna` | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Broad all-industry aggregator; auto-targets UK/Canada/India/US from your regions |
| `serpapi` | `SERPAPI_KEY` | Google Jobs — the **only** source that reaches **Dubai/UAE** |
| `reed` | `REED_API_KEY` | Reed.co.uk — best UK coverage incl. legal & on-site firms |
| `usajobs` | `USAJOBS_API_KEY`, `USAJOBS_EMAIL` | US federal jobs (off by default) |

The keyless boards are remote-leaning. For **on-site/local** roles in a specific country, add the
relevant key:

1. Get a free key (e.g. Reed: <https://www.reed.co.uk/developers>; Adzuna:
   <https://developer.adzuna.com/>; SerpAPI: <https://serpapi.com/>).
2. Copy `.env.example` to `.env` and paste your key in.
3. Tick the source in the Profile tab (or set `enabled: true` in config) and search again.

> **Never commit your `.env` or `job-applier.config.json`** — both are gitignored because they hold
> personal data and secrets. Each user supplies their own keys via `.env.example`.

> Finding company slugs: Greenhouse `boards.greenhouse.io/acme` → `acme`; Lever
> `jobs.lever.co/acme` → `acme`; Ashby `jobs.ashbyhq.com/acme` → `acme`.

## CLI

```bash
npm run discover                       # fetch + rank + store jobs
npm run apply -- --limit 20 --min 12   # generate materials, queue top matches (--all for everything)
npm run list -- --jobs                 # all discovered jobs; or --status queued|applied|skipped|all
npm run mark -- <jobId> applied "note" # set an application's status
npm run review                         # rebuild data/review.html from the queue
```

| Command | What it does |
| --- | --- |
| `npm run discover` | Fan out across enabled sources → normalize → dedupe → score → filter → save to `data/db.json`. |
| `npm run apply` | Generate tailored materials for top-scoring, unhandled jobs and queue them. Flags: `--limit N`, `--min N`, `--all`. |
| `npm run list` | Show the review queue. `--status all\|applied\|skipped`, or `--jobs` for all discovered jobs. |
| `npm run mark -- <id> <status> [note]` | Set an application's status (`applied` / `skipped`). |
| `npm run review` | Rebuild `data/review.html` from the current queue. |
| `npm run package` | Build the shareable `job-applier-mac.tar.gz`. |

## Assisted apply (local only)

The *Assisted apply* button launches a real browser (Playwright/Chromium) on **your** machine,
navigates to the job's form, pre-fills your name/email/phone/location, and attaches your CV. You
review, answer any custom questions, pass the CAPTCHA, and click submit. **It never auto-submits.**
Because it drives a browser on your computer, this feature only works when running locally — not on
a hosted deployment.

## How ranking works

`src/jobs/rank.ts` scores each job 0–100 by keyword/skill hits (title weighted heavily over body),
plus remote/region alignment and freshness. A transparent heuristic — no AI key needed. Matching is
whole-word, so short skills like "C", "Go", "AI" don't match inside unrelated words. Tune the
weights there, or the thresholds (`minScore`, `excludeTitleKeywords`, `remoteOnly`) in the config.

## Materials

Template + variable fill — `templates/resume.md` and `templates/cover-letter.md` with `{{token}}`
placeholders (e.g. `{{job.title}}`, `{{profile.experience}}`). Rendered per job into
`data/applications/<jobId>/`. If you upload a PDF CV, it's used as-is for the attachment. Edit the
templates to change every future application.

## Architecture

- **`src/jobs/`** — the engine: `pipeline.ts` (discover + queue), `sources/` (pluggable boards),
  `normalize.ts`, `rank.ts`, `regions.ts`, `store.ts` (a single `data/db.json`), `materials.ts`,
  `config.ts`.
- **`src/app/`** — a thin Next.js (App Router) UI over the engine; server actions in `actions.ts`.
- **`scripts/`** — CLI entry points run via `tsx`.

### Adding a source

Implement the `JobSource` interface (`name`, `isEnabled`, `fetch` → `RawJob[]`) in a new file under
`src/jobs/sources/`, then add it to `ALL_SOURCES` in `sources/index.ts`. Normalization, dedupe,
scoring, and persistence are handled for you.

## Data & privacy

Everything generated lives under `data/` (gitignored): `data/db.json` (jobs + applications),
`data/applications/<id>/` (materials), `data/resume.pdf` (your uploaded CV), `data/review.html`.
Nothing leaves your machine except the API calls each source makes to fetch jobs.

## License

[MIT](LICENSE).
