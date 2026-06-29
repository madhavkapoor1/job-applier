"use client";

import { useState, useTransition } from "react";
import type { DashboardState } from "../jobs/dashboard.ts";
import { REGIONS } from "../jobs/regions.ts";
import { saveProfileAction, uploadResumeAction, removeResumeAction, type ProfilePayload } from "./actions.ts";
import { Field, inputClass, btnPrimary, btnGhost } from "./components.tsx";

const splitCsv = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);
const splitLines = (s: string) =>
  s.split("\n").map((x) => x.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

interface ExpRow {
  title: string;
  company: string;
  start: string;
  end: string;
  bulletsText: string;
}
interface EduRow {
  degree: string;
  school: string;
  year: string;
}

const emptyExp = (): ExpRow => ({ title: "", company: "", start: "", end: "", bulletsText: "" });
const emptyEdu = (): EduRow => ({ degree: "", school: "", year: "" });

type ToggleKey =
  | "reed" | "themuse" | "adzuna" | "serpapi"
  | "remotive" | "remoteok" | "arbeitnow" | "jobicy" | "himalayas" | "hackernews";

// Keyless boards (top group) are on by default and need no setup. The keyed
// aggregators (bottom group) unlock far broader, all-industry, country-specific
// coverage once a free key is in .env.
const KEYLESS_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "remotive", label: "Remotive", hint: "Remote roles worldwide, many industries." },
  { key: "remoteok", label: "Remote OK", hint: "Large remote feed — eng, design, sales, support, HR, finance." },
  { key: "arbeitnow", label: "Arbeitnow", hint: "Europe + remote, all industries." },
  { key: "jobicy", label: "Jobicy", hint: "Remote jobs across many industries, matched to your keywords." },
  { key: "himalayas", label: "Himalayas", hint: "80k+ live remote jobs, broad coverage." },
  { key: "themuse", label: "The Muse", hint: "US & remote roles, lighter elsewhere." },
  { key: "hackernews", label: "Hacker News “Who is hiring”", hint: "Monthly startup roles, often remote. Tech-leaning." },
];
const KEYED_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "adzuna", label: "Adzuna (UK, Canada, India, US…)", hint: "Broad all-industry aggregator — auto-targets your chosen countries. Free API key." },
  { key: "serpapi", label: "Google Jobs — incl. Dubai/UAE", hint: "Via SerpAPI — the only source that reaches the UAE. Free tier key." },
  { key: "reed", label: "Reed.co.uk (UK)", hint: "UK's biggest board, strong for legal & all sectors. Free API key." },
];

export default function ProfileForm({
  state,
  onState,
  onSaved,
}: {
  state: DashboardState;
  onState: (s: DashboardState) => void;
  onSaved: () => void;
}) {
  const ph = state.needsSetup;
  const p = state.profile;
  const s = state.search;
  const src = state.sources;
  const enabled = (name: string) => src.find((x) => x.name === name)?.enabled ?? false;

  const [name, setName] = useState(ph ? "" : p.name);
  const [email, setEmail] = useState(ph ? "" : p.email);
  const [phone, setPhone] = useState(ph ? "" : (p.phone ?? ""));
  const [location, setLocation] = useState(ph ? "" : (p.location ?? ""));
  const [linkedin, setLinkedin] = useState(p.links?.linkedin ?? "");
  const [github, setGithub] = useState(p.links?.github ?? "");
  const [portfolio, setPortfolio] = useState(p.links?.portfolio ?? "");
  const [summary, setSummary] = useState(ph ? "" : p.summary);
  const [skills, setSkills] = useState(p.skills.join(", "));

  const [experience, setExperience] = useState<ExpRow[]>(
    ph || !p.experience.length
      ? [emptyExp()]
      : p.experience.map((e) => ({
          title: e.title,
          company: e.company,
          start: e.start,
          end: e.end,
          bulletsText: e.bullets.join("\n"),
        })),
  );
  const [education, setEducation] = useState<EduRow[]>(
    ph || !p.education.length ? [emptyEdu()] : p.education.map((e) => ({ ...e })),
  );

  const [keywords, setKeywords] = useState(s.keywords.join(", "));
  const [regions, setRegions] = useState<string[]>(s.regions ?? []);
  const [locations, setLocations] = useState(s.locations.join(", "));
  const toggleRegion = (id: string) =>
    setRegions((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const [remoteOnly, setRemoteOnly] = useState(s.remoteOnly);
  const [minScore, setMinScore] = useState(String(s.minScore ?? 12));
  const [exclude, setExclude] = useState((s.excludeTitleKeywords ?? []).join(", "));

  const [gh, setGh] = useState(state.sourceCompanies.greenhouse.join(", "));
  const [lv, setLv] = useState(state.sourceCompanies.lever.join(", "));
  const [ah, setAh] = useState(state.sourceCompanies.ashby.join(", "));
  const [wk, setWk] = useState(state.sourceCompanies.workable.join(", "));
  const [feeds, setFeeds] = useState(state.sourceCompanies.customFeeds.join("\n"));
  const [toggles, setToggles] = useState<Record<ToggleKey | "usajobs", boolean>>({
    reed: enabled("reed"),
    themuse: enabled("themuse"),
    adzuna: enabled("adzuna"),
    serpapi: enabled("serpapi"),
    remotive: enabled("remotive"),
    remoteok: enabled("remoteok"),
    arbeitnow: enabled("arbeitnow"),
    jobicy: enabled("jobicy"),
    himalayas: enabled("himalayas"),
    hackernews: enabled("hackernews"),
    usajobs: enabled("usajobs"),
  });

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<string | null>(null);

  async function onResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResumeBusy(true);
    setResumeMsg(null);
    const fd = new FormData();
    fd.append("resume", file);
    const res = await uploadResumeAction(fd);
    setResumeBusy(false);
    if (res.ok) {
      onState(res.state);
      setResumeMsg("CV uploaded ✓");
    } else {
      setResumeMsg(res.error);
    }
  }

  async function onRemoveResume() {
    setResumeBusy(true);
    onState(await removeResumeAction());
    setResumeBusy(false);
    setResumeMsg(null);
  }

  function buildPayload(): ProfilePayload {
    return {
      profile: {
        name,
        email,
        phone,
        location,
        links: { linkedin, github, portfolio },
        summary,
        skills: splitCsv(skills),
        experience: experience.map((e) => ({
          title: e.title,
          company: e.company,
          start: e.start,
          end: e.end,
          bullets: splitLines(e.bulletsText),
        })),
        education,
      },
      search: {
        keywords: splitCsv(keywords),
        regions,
        locations: splitCsv(locations),
        remoteOnly,
        minScore: Number(minScore) || 0,
        excludeTitleKeywords: splitCsv(exclude),
      },
      sources: {
        reed: toggles.reed,
        themuse: toggles.themuse,
        adzuna: toggles.adzuna,
        serpapi: toggles.serpapi,
        greenhouse: splitCsv(gh),
        lever: splitCsv(lv),
        ashby: splitCsv(ah),
        workable: splitCsv(wk),
        remotive: toggles.remotive,
        remoteok: toggles.remoteok,
        arbeitnow: toggles.arbeitnow,
        jobicy: toggles.jobicy,
        himalayas: toggles.himalayas,
        customFeeds: splitLines(feeds),
        hackernews: toggles.hackernews,
        usajobs: toggles.usajobs,
      },
    };
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveProfileAction(buildPayload());
      if (res.ok) {
        onState(res.state);
        setMsg({ kind: "ok", text: "Saved! Your profile is ready." });
        onSaved();
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.kind === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your CV (PDF)</h2>
        {state.hasResume ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            ✓ Your CV is uploaded — it will be attached to your applications.
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload your CV as a PDF. It&apos;s used as-is for applications (no edits). You can update it any time.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${btnGhost} cursor-pointer`}>
            {state.hasResume ? "Replace CV…" : "Choose PDF…"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onResumeChange} disabled={resumeBusy} />
          </label>
          {state.hasResume && (
            <button type="button" className="text-sm text-red-600 hover:underline" onClick={onRemoveResume} disabled={resumeBusy}>
              Remove
            </button>
          )}
          {resumeBusy && <span className="text-sm text-zinc-500">Uploading…</span>}
          {resumeMsg && !resumeBusy && <span className="text-sm text-zinc-600 dark:text-zinc-300">{resumeMsg}</span>}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </Field>
          <Field label="Location">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
          </Field>
          <Field label="LinkedIn">
            <input className={inputClass} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/you" />
          </Field>
          <Field label="GitHub / Portfolio">
            <input className={inputClass} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/you" />
          </Field>
        </div>
        <Field label="Portfolio / website (optional)">
          <input className={inputClass} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://you.dev" />
        </Field>
        <Field label="Professional summary" hint="A short paragraph about who you are. Used in your cover letter.">
          <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label="Skills" hint="Separate with commas. These also drive job matching.">
          <textarea className={inputClass} rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="TypeScript, React, Node.js, AWS" />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Work experience</h2>
          <button type="button" className={btnGhost} onClick={() => setExperience((x) => [...x, emptyExp()])}>
            + Add role
          </button>
        </div>
        {experience.map((row, i) => (
          <div key={i} className="space-y-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputClass} value={row.title} placeholder="Job title" onChange={(e) => updateExp(setExperience, i, "title", e.target.value)} />
              <input className={inputClass} value={row.company} placeholder="Company" onChange={(e) => updateExp(setExperience, i, "company", e.target.value)} />
              <input className={inputClass} value={row.start} placeholder="Start (e.g. 2021)" onChange={(e) => updateExp(setExperience, i, "start", e.target.value)} />
              <input className={inputClass} value={row.end} placeholder="End (e.g. Present)" onChange={(e) => updateExp(setExperience, i, "end", e.target.value)} />
            </div>
            <textarea className={inputClass} rows={3} value={row.bulletsText} placeholder="One achievement per line" onChange={(e) => updateExp(setExperience, i, "bulletsText", e.target.value)} />
            {experience.length > 1 && (
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setExperience((x) => x.filter((_, j) => j !== i))}>
                Remove this role
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Education</h2>
          <button type="button" className={btnGhost} onClick={() => setEducation((x) => [...x, emptyEdu()])}>
            + Add
          </button>
        </div>
        {education.map((row, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-3">
            <input className={inputClass} value={row.degree} placeholder="Degree" onChange={(e) => updateEdu(setEducation, i, "degree", e.target.value)} />
            <input className={inputClass} value={row.school} placeholder="School" onChange={(e) => updateEdu(setEducation, i, "school", e.target.value)} />
            <input className={inputClass} value={row.year} placeholder="Year" onChange={(e) => updateEdu(setEducation, i, "year", e.target.value)} />
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">What jobs to look for</h2>
        <Field label="Keywords / job titles" hint="Separate with commas.">
          <input className={inputClass} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="software engineer, full stack, react" />
        </Field>

        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Countries / regions</p>
          <p className="mb-2 text-xs text-zinc-500">
            Pick where to search. We point each job source at these and prioritise matching roles
            (remote roles always count too). Leave all unticked to search worldwide.
          </p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const on = regions.includes(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggleRegion(r.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {on ? "✓ " : ""}{r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specific cities (optional)" hint="Comma-separated — narrows within the regions above. Blank = country-wide.">
            <input className={inputClass} value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="London, Toronto" />
          </Field>
          <Field label="Minimum match score" hint="Higher = stricter. 12 is a good default.">
            <input type="number" className={inputClass} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          </Field>
        </div>
        <Field label="Exclude titles containing" hint="Comma-separated. Jobs whose title contains these are dropped.">
          <input className={inputClass} value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="intern, principal" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="h-4 w-4 rounded" />
          Only show remote jobs
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Which job sources</h2>

        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            No setup needed — on by default
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            These work straight away with no API key. Leave them all on for the widest search.
          </p>
          <div className="space-y-2">
            {KEYLESS_TOGGLES.map(({ key, label, hint }) => (
              <label key={key} className="flex items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded"
                />
                <span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
                  <span className="block text-xs text-zinc-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Add a free API key for full, all-industry, country-specific coverage
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            The keyless boards above are remote-leaning. For on-site & local roles in your chosen
            countries (and the only way to reach <strong>Dubai/UAE</strong>), drop a free key into the{" "}
            <code>.env</code> file — see the README — then tick the source.
          </p>
          <div className="space-y-2">
            {KEYED_TOGGLES.map(({ key, label, hint }) => (
              <label key={key} className="flex items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded"
                />
                <span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
                  <span className="block text-xs text-zinc-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Add any job board by feed URL (RSS/Atom)
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            Paste one feed URL per line — any board that publishes an RSS/Atom feed works, no code.
            E.g. <code>https://weworkremotely.com/remote-jobs.rss</code>. Jobs are filtered by your
            keywords like every other source.
          </p>
          <textarea
            className={inputClass}
            rows={3}
            value={feeds}
            onChange={(e) => setFeeds(e.target.value)}
            placeholder={"https://weworkremotely.com/remote-jobs.rss\nhttps://example.com/careers/feed"}
          />
        </div>

        <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Advanced: pull from specific company career pages (optional — not needed)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Greenhouse handles" hint="from boards.greenhouse.io/<handle>">
              <input className={inputClass} value={gh} onChange={(e) => setGh(e.target.value)} />
            </Field>
            <Field label="Lever handles">
              <input className={inputClass} value={lv} onChange={(e) => setLv(e.target.value)} />
            </Field>
            <Field label="Ashby handles">
              <input className={inputClass} value={ah} onChange={(e) => setAh(e.target.value)} />
            </Field>
            <Field label="Workable handles">
              <input className={inputClass} value={wk} onChange={(e) => setWk(e.target.value)} />
            </Field>
          </div>
        </details>
      </section>

      <div className="sticky bottom-4 flex items-center gap-3">
        <button type="button" className={btnPrimary} onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <span className="text-sm text-zinc-500">Saved locally on your computer.</span>
      </div>
    </div>
  );
}

function updateExp(
  setExperience: React.Dispatch<React.SetStateAction<ExpRow[]>>,
  i: number,
  key: keyof ExpRow,
  value: string,
) {
  setExperience((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
}
function updateEdu(
  setEducation: React.Dispatch<React.SetStateAction<EduRow[]>>,
  i: number,
  key: keyof EduRow,
  value: string,
) {
  setEducation((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
}
