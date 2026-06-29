"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardState } from "../jobs/dashboard.ts";
import { ensureFreshAction } from "./actions.ts";
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
  const checkedRef = useRef(false);

  // On open, automatically look for new jobs (server-gated so it only actually
  // searches when results are stale — instant otherwise).
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setChecking(true);
    ensureFreshAction()
      .then((res) => setState(res.state))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const reviewCount = state.queue.filter((q) => q.status === "queued").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Job Applier
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fill in your details once, find matching jobs, and apply with ready-made materials.
        </p>
        {checking && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
            Checking for new jobs…
          </p>
        )}
      </header>

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
          <ProfileForm state={state} onState={setState} onSaved={() => setTab("jobs")} />
        )}
        {tab === "jobs" && (
          <JobsPanel state={state} onState={setState} goReview={() => setTab("review")} />
        )}
        {tab === "review" && <QueuePanel state={state} onState={setState} />}
      </main>
    </div>
  );
}
