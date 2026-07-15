"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardState } from "../jobs/dashboard.ts";
import { ensureFreshAction, switchProfileAction, createProfileAction } from "./actions.ts";
import ProfileForm from "./ProfileForm";
import JobsPanel from "./JobsPanel";
import QueuePanel from "./QueuePanel";

type Tab = "profile" | "jobs" | "review";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "1 · Your Profile" },
  { id: "jobs", label: "2 · Find Jobs" },
  { id: "review", label: "3 · Review & Apply" },
];

export default function Dashboard({ initial }: { initial: DashboardState }) {
  const [state, setState] = useState<DashboardState>(initial);
  const [tab, setTab] = useState<Tab>(initial.needsSetup ? "profile" : "jobs");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const checkedRef = useRef(false);

  // On open, automatically look for new jobs (server-gated so it only actually
  // searches when results are stale — instant otherwise).
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setChecking(true);
    ensureFreshAction()
      .then((res) => {
        setState(res.state);
        const failed = Object.entries(res.summary?.errors ?? {});
        if (failed.length) {
          setNotice(
            `Some job sources didn't respond: ${failed.map(([name]) => name).join(", ")}. ` +
              `Results may be incomplete — check your internet connection and API keys, then search again.`,
          );
        }
      })
      .catch(() => {
        setNotice(
          "Couldn't check for new jobs — you may be offline. You can still review prepared applications.",
        );
      })
      .finally(() => setChecking(false));
  }, []);

  const reviewCount = state.queue.filter((q) => q.status === "queued").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Job Applier
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Fill in your details once, find matching jobs, and apply with ready-made materials.
            </p>
          </div>
          <ProfileSwitcher
            state={state}
            onState={(s) => {
              setState(s);
              if (s.needsSetup) setTab("profile");
            }}
          />
        </div>
        {checking && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
            Checking for new jobs…
          </p>
        )}
      </header>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{notice}</span>
          <button
            type="button"
            className="shrink-0 font-medium hover:underline"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {state.needsSetup && tab !== "profile" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          Start by filling in <strong>Your Profile</strong> so applications are written for you.
        </div>
      )}

      <nav className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t.label}
            {t.id === "review" && reviewCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {tab === "profile" && (
          <ProfileForm
            key={state.activeProfile}
            state={state}
            onState={setState}
            onSaved={() => setTab("jobs")}
          />
        )}
        {tab === "jobs" && (
          <JobsPanel state={state} onState={setState} goReview={() => setTab("review")} />
        )}
        {tab === "review" && <QueuePanel state={state} onState={setState} />}
      </main>
    </div>
  );
}

/**
 * Everyone using this install gets their own profile (details, searches, and
 * queue are fully separate). Switching changes which person's data the whole
 * app — web and CLI — works with.
 */
function ProfileSwitcher({
  state,
  onState,
}: {
  state: DashboardState;
  onState: (s: DashboardState) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(slug: string) {
    if (slug === "__new") {
      setAdding(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await switchProfileAction(slug);
    setBusy(false);
    if (res.ok) onState(res.state);
    else setError(res.error);
  }

  async function onCreate() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createProfileAction(name);
    setBusy(false);
    if (res.ok) {
      onState(res.state);
      setAdding(false);
      setName("");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500">Who&apos;s applying?</label>
        {adding ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="Their name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-2 py-1 text-sm font-medium text-white disabled:opacity-50"
              onClick={onCreate}
              disabled={busy || !name.trim()}
            >
              Add
            </button>
            <button
              type="button"
              className="px-1 text-sm text-zinc-500 hover:underline"
              onClick={() => setAdding(false)}
            >
              ✕
            </button>
          </span>
        ) : (
          <select
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={state.activeProfile}
            onChange={(e) => onSelect(e.target.value)}
            disabled={busy}
          >
            {state.profiles.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
            <option value="__new">＋ Add person…</option>
          </select>
        )}
        {busy && <span className="text-xs text-zinc-500">Switching…</span>}
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-300">{error}</span>}
    </div>
  );
}
