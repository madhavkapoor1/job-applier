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
  const [error, setError] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);

  const enabledSources = state.sources.filter((s) => s.enabled).map((s) => s.name);
  const directCount = state.jobs.filter((j) => j.direct).length;
  const visibleJobs = directOnly ? state.jobs.filter((j) => j.direct) : state.jobs;
  const failedSources = Object.entries(summary?.errors ?? {});

  function findJobs() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await discoverAction();
        setSummary(res.summary);
        onState(res.state);
      } catch (err) {
        setError(
          `The search couldn't finish (${(err as Error).message}). Check your internet connection and try again.`,
        );
      }
    });
  }

  function prepare(id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        const res = await queueAction(id);
        onState(res.state);
        if (!res.ok) setError(`Couldn't prepare that application: ${res.error}`);
      } catch (err) {
        setError(`Couldn't prepare that application: ${(err as Error).message}`);
      } finally {
        setBusyId(null);
      }
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          The app checks for new jobs automatically each time you open it.
        </p>
        {state.jobs.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(e) => setDirectOnly(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Direct apply only <span className="text-zinc-400">({directCount})</span>
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          Found <strong>{summary.kept}</strong> matching jobs (from {summary.fetched} postings).
          {summary.added > 0 && ` ${summary.added} new since last search.`}
          {failedSources.length > 0 && (
            <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>{failedSources.length}</strong> source{failedSources.length === 1 ? "" : "s"}{" "}
              failed, so results may be incomplete:
              <ul className="mt-1 list-inside list-disc">
                {failedSources.map(([name, message]) => (
                  <li key={name}>
                    <span className="font-medium">{name}</span>: {message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state.jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {state.lastDiscoveryAt
            ? "No new jobs right now — everything found is already in your review list. Add a free Reed API key (Your Profile → API keys) for far more UK results."
            : "Searching for jobs…"}
        </p>
      ) : visibleJobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No “direct apply” jobs in this batch. Untick the filter to see all {state.jobs.length},
          or add a Google Jobs (SerpAPI) key for more company-direct listings.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleJobs.map((job) => (
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
                    {job.direct && (
                      <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        ✓ Direct apply
                      </span>
                    )}
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
