"use client";

import { useState, useTransition } from "react";
import type { DashboardState } from "../jobs/dashboard.ts";
import type { DiscoverySummary } from "../jobs/pipeline.ts";
import { discoverAction, queueAction } from "./actions.ts";
import { ScoreBadge, btnPrimary, btnGhost } from "./components.tsx";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diffMs)) return "recently";
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function JobsPanel({
  state,
  onState,
  goReview,
}: {
  state: DashboardState;
  onState: (s: DashboardState) => void;
  goReview: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const enabledSources = state.sources.filter((s) => s.enabled).map((s) => s.name);

  function findJobs() {
    startTransition(async () => {
      const res = await discoverAction();
      setSummary(res.summary);
      onState(res.state);
    });
  }

  function prepare(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const next = await queueAction(id);
      onState(next);
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} onClick={findJobs} disabled={pending}>
          {pending && !busyId ? "Searching…" : "Check for new jobs"}
        </button>
        <span className="text-sm text-zinc-500">
          {state.lastDiscoveryAt
            ? `Last checked ${relativeTime(state.lastDiscoveryAt)}`
            : "Not checked yet"}
          {" · "}
          {enabledSources.join(", ") || "no sources enabled"}
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        The app checks for new jobs automatically each time you open it.
      </p>

      {summary && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          Found <strong>{summary.kept}</strong> matching jobs (from {summary.fetched} postings).
          {summary.added > 0 && ` ${summary.added} new since last search.`}
        </div>
      )}

      {state.jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {state.lastDiscoveryAt
            ? "No new jobs right now — everything found is already in your review list. Add a Reed API key (see README) for far more UK results."
            : "Searching for jobs…"}
        </p>
      ) : (
        <ul className="space-y-3">
          {state.jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex gap-3">
                <ScoreBadge score={job.score} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{job.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {job.company} · {job.location}
                    {job.remote && <span className="ml-2 text-emerald-600">remote</span>}
                    <span className="ml-2 uppercase tracking-wide text-[11px] text-zinc-400">
                      {job.source}
                    </span>
                  </p>
                  {job.matchedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.matchedKeywords.slice(0, 8).map((k) => (
                        <span
                          key={k}
                          className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  {job.snippet && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{job.snippet}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className={btnGhost}
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open posting ↗
                    </a>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => prepare(job.id)}
                      disabled={pending}
                    >
                      {busyId === job.id ? "Preparing…" : "Prepare application"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {state.queue.length > 0 && (
        <button type="button" className="text-sm font-medium text-indigo-600 hover:underline" onClick={goReview}>
          Go to Review &amp; Apply ({state.queue.filter((q) => q.status === "queued").length} ready) →
        </button>
      )}
    </div>
  );
}
