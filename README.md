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
> countries, and skills in the **Profile** tab and it retargets to any field, anywhere — and each
> person on the machine gets their own profile via the header switcher.

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

Everything is stored locally. **Several people can share one install**: use the *"Who's
applying?"* switcher in the header to add a person — each profile keeps its own details, searches,
found jobs, and application queue under `data/profiles/<name>/` (gitignored). Until a profile is
saved, the app runs on the committed `job-applier.config.example.json` template. The web form and
CLI share the same active profile; CLI scripts accept `--profile <name>` for a one-off override.

### Non-technical users (Mac / Windows)

No terminal needed. Build a self-contained package and send it to anyone:

```bash
npm run package      # produces job-applier-mac.tar.gz
```

The recipient unzips and double-clicks **`start-mac.command`** (macOS) or **`start-windows.bat`**
(Windows). First run downloads a private copy of Node + the browser (no admin password), then
opens the app. See `START-HERE-MAC.txt` in the package.

## Any field, any country

**Not technical, or not in tech?** The Profile tab has one-click **field presets** — Legal,
Healthcare & Nursing, Finance, Teaching, Marketing, Sales, Admin, Hospitality, Engineering, and
more — that fill in sensible keywords for you. Pick your field, pick your countries, save.

**The universal source:** the free **Google Jobs (SerpAPI)** key pulls real listings for *any*
profession in *any* country — it's the single key that makes "anywhere" actually work (the keyless
boards lean towards remote tech). Add it in Profile → API keys.

Pick any combination of **UK · Canada · India · Dubai/UAE · US · Australia · Germany · Ireland ·
Singapore · New Zealand · Global/Remote** in the Profile tab (or type any city under "Specific
cities"). Each region points the sources at the right place and gives in-region roles a ranking
boost. Semantics are **"country + remote/global"** — region is a ranking nudge, never a hard
filter, so remote and worldwide roles always stay eligible. See `src/jobs/regions.ts`.

## Applying to many jobs quickly

The **Review & Apply** tab has **"Prepare & open"**: it opens your ready applications in one
browser window, each on its real application form with your name, email, phone, CV, and AI cover
letter **already filled in** — you just review, answer any custom questions, pass the CAPTCHA, and
click Submit. Works on Greenhouse, Lever, Ashby, and Workable forms (roughly 8 at a time).

> **Why not fully automatic?** The tool never clicks Submit for you. Auto-submitted generic
> applications get auto-rejected, and most portals have CAPTCHAs. The pre-fill removes the tedious
> 90% while keeping the human check that actually lands interviews. Jobs that don't link to a
> recognised application form still open individually with **Open & Apply**.

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
| `customfeeds` | **Any** board's RSS/Atom feed — paste a URL, no code (see below) |
| `greenhouse` / `lever` / `ashby` / `workable` | Per-company ATS boards (optional — add company slugs) |

**Keyed — add a free key (Profile tab → API keys) for on-site & country-specific coverage:**

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
2. Paste it into **Profile tab → API keys** (it's written to `.env` for you — no file editing),
   or edit `.env` by hand if you prefer (`cp .env.example .env`).
3. Tick the source in the Profile tab and search again. The tab shows a "✓ key added" /
   "key needed" badge next to each keyed source.

**AI-written cover letters:** add an `ANTHROPIC_API_KEY` in the same section and every prepared
cover letter is written by Claude for that specific job (~a penny per letter). Without it,
letters use the built-in template — everything still works offline.

> **Never commit your `.env` or anything under `data/`** — both are gitignored because they hold
> personal data and secrets. API keys are per-install and shared by all profiles on the machine.

> Finding company slugs: Greenhouse `boards.greenhouse.io/acme` → `acme`; Lever
> `jobs.lever.co/acme` → `acme`; Ashby `jobs.ashbyhq.com/acme` → `acme`.

## CLI

```bash
npm run discover                       # fetch + rank + store jobs
npm run apply -- --limit 20 --min 12   # generate materials, queue top matches (--all for everything)
npm run list -- --jobs                 # all discovered jobs; or --status queued|applied|skipped|all
npm run mark -- <jobId> applied "note" # set an application's status
npm run review                         # rebuild the review page from the queue
```

Every script accepts `--profile <name>` to target another person's profile for that run
(otherwise they use whichever profile is active in the web app).

| Command | What it does |
| --- | --- |
| `npm run discover` | Fan out across enabled sources → normalize → dedupe → score → filter → save to `data/db.json`. |
| `npm run apply` | Generate tailored materials for top-scoring, unhandled jobs and queue them. Flags: `--limit N`, `--min N`, `--all`. |
| `npm run list` | Show the review queue. `--status all\|applied\|skipped`, or `--jobs` for all discovered jobs. |
| `npm run mark -- <id> <status> [note]` | Set an application's status (`applied` / `skipped`). |
| `npm run review` | Rebuild `data/review.html` from the current queue. |
| `npm run package` | Build the shareable `job-applier-mac.tar.gz`. |

## Tests

```bash
npm test            # unit suite (offline, no extra dependencies)
npm run test:live   # optional: hits the live keyless APIs to confirm they still map
```

Tests live next to the code (`src/**/*.test.ts`) and use Node's built-in test runner via `tsx`, so
there's nothing extra to install. They cover the engine logic — ranking/word-boundary matching,
region targeting, normalization, location parsing, and the RSS/Atom feed parser. `npm test` is
fully offline; live-API checks are kept separate in `npm run test:live`.

## Assisted apply (local only)

The *Assisted apply* button launches a real browser (Playwright/Chromium) on **your** machine,
navigates to the job's form, pre-fills your name/email/phone/location, and attaches your CV. You
review, answer any custom questions, pass the CAPTCHA, and click submit. **It never auto-submits.**
Because it drives a browser on your computer, this feature only works when running locally — not on
a hosted deployment.

## Direct apply vs. aggregators

Some sources land you on the **company's own application page** (where you actually apply, and
where *assisted apply* can pre-fill the form); others are aggregators whose link is their own
listing page. Direct sources are **Greenhouse / Lever / Ashby / Workable** (company ATS),
**Google Jobs** (`serpapi` — apply links usually point at the company/ATS), and **USAJobs**. These
get a ranking boost so they float above aggregator listings, are tagged **✓ Direct apply** in the
Find Jobs list, and can be isolated with the **"Direct apply only"** filter.

To actually get direct-apply jobs you need at least one direct source active: add a free
**Google Jobs (SerpAPI)** key (broadest, any country), and/or add company handles for the ATS
boards. Without them, results are aggregator listings only.

## How ranking works

`src/jobs/rank.ts` scores each job 0–100 by keyword/skill hits (title weighted heavily over body),
plus remote/region alignment, freshness, and a **direct-apply** boost (see above). A transparent
heuristic — no AI key needed. Matching is whole-word, so short skills like "C", "Go", "AI" don't
match inside unrelated words. Tune the weights there, or the thresholds (`minScore`,
`excludeTitleKeywords`, `remoteOnly`) in the config.

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

### Adding more job boards

Three ways, easiest first:

1. **Any board with an RSS/Atom feed** — paste its feed URL into *"Add any job board by feed URL"*
   in the Profile tab (or `sources.customfeeds.urls`). No code. Covers most niche / country /
   company-career boards.
2. **A company on Greenhouse / Lever / Ashby / Workable** — add its handle in the Profile tab. No
   code.
3. **A board with a bespoke JSON API** — implement the `JobSource` interface (`name`, `isEnabled`,
   `fetch` → `RawJob[]`) in a new file under `src/jobs/sources/` and register it in
   `sources/index.ts`. Normalization, dedupe, scoring, and persistence are handled for you. See
   **[CONTRIBUTING.md](CONTRIBUTING.md)** for a step-by-step example.

> **Walled gardens:** LinkedIn and Indeed have no usable public job API (Indeed retired theirs;
> LinkedIn never offered one, and scraping both is against their terms). Many of their listings are
> still reachable indirectly through **Google Jobs** (the `serpapi` source).

## Data & privacy

Everything generated lives under `data/` (gitignored), one directory per person:
`data/profiles/<name>/` holds that person's `config.json` (profile + search), `db.json` (jobs +
applications), `applications/<id>/` (materials), `resume.pdf` (uploaded CV), and `review.html`.
Writes are crash-safe (temp-file + rename), and a corrupted `db.json` is backed up — never
silently reset. Nothing leaves your machine except the API calls each source makes to fetch jobs
(and, if you add an Anthropic key, the cover-letter requests to Claude).

## License

[MIT](LICENSE).
