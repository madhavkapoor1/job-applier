# Job Applier — Complete Guide

A personal tool that **finds jobs, ranks them against your profile, and writes a tailored CV +
cover letter for each one** so you can apply in a couple of minutes instead of twenty. It works
for **any profession, in any country** — the example is set up for a UK paralegal broadening into
ESG / legal-tech / AI, but a one-click preset retargets it to nursing, finance, teaching, software,
and more (Part 6).

There are two ways to use it:
- **The website** (no tech skills needed) — a simple 3-step page in your browser.
- **The command line** (for power users) — the same engine, scriptable.

---

## Part 1 — What it actually does

1. **Finds jobs** automatically from several sources every time you open it.
2. **Ranks** each job 0–100 on how well it fits your skills and keywords.
3. **Auto-writes** a tailored CV + cover letter for your best matches. (Add a free Claude key and
   each cover letter is written by AI for that specific job — see Part 4.)
4. **Speeds up applying** — the "Prepare & open" button on Review & Apply opens several forms at
   once, each pre-filled with your details, CV, and cover letter.
5. **Tracks** what you've applied to so you never apply twice, and lets several people each keep
   their own profile.

**What it does NOT do:** it does not click "submit" for you. It pre-fills the form; you review,
answer any custom questions, and submit — that final human step keeps quality high (auto-submitted
generic applications get auto-rejected).

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
| `npm run review` | Build a standalone `review.html` page of your queue (in your profile folder) |

---

## Part 4 — Getting many more jobs (free Reed key, 2 minutes)

This is the most important upgrade. Without it, the app is limited; with it, it pulls hundreds of
UK legal roles.

1. Go to **https://www.reed.co.uk/developers** and register (free).
2. Confirm your email, then click **"Create a new API key"** — copy the long string.
3. In the app, open **Your Profile → API keys**, paste the key into the **Reed.co.uk** box, and
   click **Save keys**. That's it — no files to edit, no restart; the next search uses it.

(Optional extras in the same section: **Adzuna** at https://developer.adzuna.com gives even more
listings, and a **Claude (Anthropic)** key makes every cover letter AI-written for the specific
job — about a penny per letter.)

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

The example is set up for UK legal roles, but it works for **any profession, anywhere** — all from
the **Your Profile** tab, no files to edit:
- **Quick start — pick your field**: one click fills in sensible keywords for Legal, Healthcare &
  Nursing, Finance, Teaching, Marketing, Sales, Admin, Engineering, and more. Edit them after if
  you like.
- **Countries / regions**: tick any of UK, Canada, India, Dubai/UAE, US, Australia, Germany,
  Ireland, Singapore, New Zealand, or Global/Remote — or type a specific city.
- **Different people**: use the **"Who's applying?"** switcher at the top to add another person —
  each gets their own profile, searches, and application queue.
- The single biggest coverage upgrade for any field/country is the free **Google Jobs (SerpAPI)**
  key — add it under Profile → API keys (Part 4).

---

## Part 7 — Your data & privacy

- All personal details and job data live **on this computer only**, under `data/profiles/<name>/`
  (one folder per person), and your API keys live in `.env`. Both are excluded from git, so they're
  never committed or shared by accident.
- The committed `job-applier.config.example.json` is just a blank template.
- The app talks to public job-board APIs to fetch listings. It does not send your CV anywhere — you
  do the actual submitting. (If you add a Claude key for AI cover letters, only the job description
  and your profile are sent to write each letter.)

---

## Troubleshooting

- **Page won't load** → the app isn't running; do `npm run dev` (Part 5).
- **"Checking for new jobs…" then nothing** → with no Reed key the pool is small; add the key
  (Part 4). Also check your internet connection.
- **Few/no results** → broaden keywords/locations in the Profile tab, or add the Reed key.
- **Materials look generic** → edit `templates/resume.md` and `templates/cover-letter.md`; the
  `{{tokens}}` are filled from your profile.
