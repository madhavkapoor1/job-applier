# Job Applier — Complete Guide

A personal tool that **finds UK legal jobs, ranks them against your profile, and writes a
tailored CV + cover letter for each one** so you can apply in a couple of minutes instead of
twenty. Built for a paralegal broadening into ESG / legal-tech / AI, but easily retargeted.

There are two ways to use it:
- **The website** (no tech skills needed) — a simple 3-step page in your browser.
- **The command line** (for power users) — the same engine, scriptable.

---

## Part 1 — What it actually does

1. **Finds jobs** automatically from several UK sources every time you open it.
2. **Ranks** each job 0–100 on how well it fits your skills and keywords.
3. **Auto-writes** a tailored CV + cover letter for your best matches.
4. **Tracks** what you've applied to so you never apply twice.

**What it does NOT do:** it does not click "submit" on application forms for you. You open the
job, paste in the ready-made CV + cover letter, and submit — that final human step keeps quality
high (auto-submitted generic applications get auto-rejected, and that matters for legal roles).

### Where it looks for jobs

- **The Muse** — works with no setup (limited legal volume).
- **Company career pages** — Monzo, Wayve, GoCardless, Trustpilot, Tide (their in-house
  legal / compliance / ESG / policy roles). No setup.
- **Reed.co.uk** and **Adzuna** — the UK's big job boards, *huge* legal coverage. These need a
  free API key (2-minute signup, see Part 4). **This is the single biggest upgrade** — without a
  key you'll see a few dozen jobs; with Reed you'll see hundreds.

---

## Part 2 — How to use it (the website)

Open **http://localhost:3000** in your browser. (If it's not loading, see "Starting the app" in
Part 5.)

### Step 1 — Your Profile
Fill in the form: name, contact details, a short summary about yourself, your skills, work
experience (click **+ Add role** for each job), and what kind of jobs you want (keywords,
locations, etc.). Click **Save profile**.

> Everything is saved **only on this computer**. Nothing is uploaded anywhere.

### Step 2 — Find Jobs
The app checks for new jobs automatically when you open it (you'll see "Checking for new jobs…").
You can also click **Check for new jobs** any time. Jobs appear ranked by match score. The app
also **auto-prepares** ready-to-send applications for your top ~15 matches.

### Step 3 — Review & Apply
This tab holds your ready-to-send applications. For each one:
1. Click **Open & Apply ↗** — the real job posting opens in a new tab.
2. Switch between **Cover letter** and **Resume**, click **Copy**.
3. Paste into the company's application form and submit.
4. Come back and click **Mark as applied** (or **Skip**).

That's the whole loop. The "Done" section keeps a record of everything you've applied to.

---

## Part 3 — How to use it (command line, optional)

Same engine, run from a terminal in the project folder:

| Command | What it does |
| --- | --- |
| `npm run discover` | Search all sources and save matching jobs |
| `npm run apply` | Write CV + cover letter for the top matches (`-- --limit 30`, `-- --all`) |
| `npm run list` | Show your review queue (`-- --jobs` for all found jobs) |
| `npm run mark -- <id> applied` | Record that you applied (or `skipped`) |
| `npm run review` | Build a standalone `data/review.html` page of the queue |

---

## Part 4 — Getting many more jobs (free Reed key, 2 minutes)

This is the most important upgrade. Without it, the app is limited; with it, it pulls hundreds of
UK legal roles.

1. Go to **https://www.reed.co.uk/developers** and register (free).
2. Confirm your email, then click **"Create a new API key"** — copy the long string.
3. In the project folder, open the file named **`.env`** in a text editor.
4. Put the key after `REED_API_KEY=` so the line reads exactly:
   `REED_API_KEY=paste-the-long-string-here` (no spaces, no quotes).
5. Save the file and restart the app (Part 5).

(Optional: **Adzuna** at https://developer.adzuna.com gives even more — same idea, fill in
`ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in `.env`.)

---

## Part 5 — Starting and stopping the app

**On a Mac, the easy way:** just double-click **`start-mac.command`**. It sets everything up the
first time (no admin password needed) and opens the app. See `START-HERE-MAC.txt`. To stop it,
close the window that appears.

**Manual way (any OS):** open a terminal in the project folder and run:
```
npm run dev
```
Then open http://localhost:3000. Leave the terminal window open while you use it.

**Stop:** click the terminal window and press **Ctrl + C**.

**First time only**, before the first `npm run dev`, run once:
```
npm install
```

---

## Part 6 — Retargeting it (different field or country)

It's currently set for UK legal roles, but it's general. Edit `job-applier.config.json` (or just
use the Profile form):
- **keywords / skills** drive what's searched and how jobs are scored.
- **locations** — e.g. `["London", "United Kingdom", "Remote"]`. A country name keeps searches
  country-wide; a city narrows to that city.
- **The Muse category** (`sources.themuse.category`) — e.g. `"Software Engineering"`,
  `"Finance"`, etc.
- **company career pages** — add any company's Greenhouse/Lever/Ashby/Workable handle (from
  their careers URL) under `sources`.

---

## Part 7 — Your data & privacy

- All personal details and job data live **on this computer only**, in `data/` and
  `job-applier.config.json`. Both are excluded from git, so they're never committed/shared by
  accident.
- The committed `job-applier.config.example.json` is just a blank template.
- The app talks to public job-board APIs to fetch listings; it does not send your CV anywhere —
  you do the actual submitting.

---

## Troubleshooting

- **Page won't load** → the app isn't running; do `npm run dev` (Part 5).
- **"Checking for new jobs…" then nothing** → with no Reed key the pool is small; add the key
  (Part 4). Also check your internet connection.
- **Few/no results** → broaden keywords/locations in the Profile tab, or add the Reed key.
- **Materials look generic** → edit `templates/resume.md` and `templates/cover-letter.md`; the
  `{{tokens}}` are filled from your profile.
