"use client";

import { useState, useTransition } from "react";
import type { DashboardState, QueueCard } from "../jobs/dashboard.ts";
import { markAction, assistApplyAction, assistApplyAllAction } from "./actions.ts";
import { ScoreBadge, CopyButton, btnPrimary, btnGhost } from "./components.tsx";
import type { ApplicationStatus } from "../jobs/types.ts";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  queued: "Ready to apply",
  applied: "Applied",
  skipped: "Skipped",
  error: "Error",
};

export default function QueuePanel({
  state,
  onState,
}: {
  state: DashboardState;
  onState: (s: DashboardState) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function mark(id: string, status: ApplicationStatus) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        const next = await markAction(id, status);
        onState(next);
      } catch (err) {
        setError(`Couldn't save that change: ${(err as Error).message}. Please try again.`);
      } finally {
        setBusyId(null);
      }
    });
  }

  if (state.queue.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Nothing here yet. Go to <strong>Find Jobs</strong> and click “Prepare application” on the
        roles you like — they’ll show up here with a ready-to-send CV and cover letter.
      </p>
    );
  }

  const ready = state.queue.filter((q) => q.status === "queued");
  const done = state.queue.filter((q) => q.status !== "queued");
  const assistableReady = ready.filter((q) => q.assistable);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The applications you prepared, ready to send.
        {state.aiEnabled && " Cover letters are AI-written for each specific job. ✨"}
        {" "}For each one: open the posting, copy your cover letter and resume into their form,
        submit, then mark it applied.
      </p>

      {assistableReady.length > 0 && (
        <BatchApplyBar count={assistableReady.length} onError={setError} />
      )}

      <ul className="space-y-4">
        {ready.map((item) => (
          <QueueItemCard key={item.id} item={item} busy={busyId === item.id && pending} onMark={mark} />
        ))}
      </ul>

      {done.length > 0 && (
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Done ({done.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {done.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50"
              >
                <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                  <span
                    className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.status === "applied"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  {item.title} — {item.company}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-indigo-600 hover:underline disabled:opacity-50"
                  onClick={() => mark(item.id, "queued")}
                  disabled={pending}
                >
                  Move back
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * "Open and pre-fill several ready applications at once" — the closest thing to
 * mass-apply that still keeps quality: each form opens in its own tab, pre-filled,
 * and the user reviews + submits. We never auto-submit.
 */
function BatchApplyBar({
  count,
  onError,
}: {
  count: number;
  onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    onError(null);
    const res = await assistApplyAllAction();
    setBusy(false);
    if (!res.ok) {
      onError(`Couldn't open the applications: ${res.error}`);
      return;
    }
    if (res.opened === 0) {
      setResult(
        "None of the ready applications use a form we can pre-fill yet — open them individually with “Open & Apply”.",
      );
      return;
    }
    const more = res.remaining > 0 ? ` ${res.remaining} more are waiting — click again when you've finished these.` : "";
    const skip = res.skipped > 0 ? ` (${res.skipped} use forms we can't pre-fill — do those with “Open & Apply”.)` : "";
    setResult(
      `Opened ${res.opened} application${res.opened === 1 ? "" : "s"} in a new browser window, each pre-filled. ` +
        `Review each one, finish any extra questions, and click Submit.${more}${skip}`,
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
            Apply to several at once
          </p>
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            Opens your ready applications in one window, each form pre-filled — you just review and
            submit. {count} ready to pre-fill.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={run} disabled={busy}>
          {busy ? "Opening…" : `✨ Prepare & open ${count > 8 ? "8" : count}`}
        </button>
      </div>
      {result && (
        <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100">
          {result}
        </p>
      )}
    </div>
  );
}

function QueueItemCard({
  item,
  busy,
  onMark,
}: {
  item: QueueCard;
  busy: boolean;
  onMark: (id: string, status: ApplicationStatus) => void;
}) {
  const [show, setShow] = useState<"cover" | "resume">("cover");
  const [assisting, setAssisting] = useState(false);
  const [assistMsg, setAssistMsg] = useState<string | null>(null);
  const text = show === "cover" ? item.coverLetter : item.resume;
  const canAssist = item.assistable;

  async function assist() {
    setAssisting(true);
    setAssistMsg(null);
    const res = await assistApplyAction(item.id);
    setAssisting(false);
    setAssistMsg(
      res.ok
        ? `Opened with ${res.filled.length ? res.filled.join(", ") + " filled" : "the form"}. Finish the questions and submit in the browser window that opened.`
        : `Couldn't auto-fill: ${res.error}. Use “Open & Apply” instead.`,
    );
  }

  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex gap-3">
        <ScoreBadge score={item.score} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {item.company} · {item.location}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canAssist && (
            <button type="button" className={btnPrimary} onClick={assist} disabled={assisting}>
              {assisting ? "Opening…" : "✨ Assisted apply"}
            </button>
          )}
          <a
            className={canAssist ? btnGhost : btnPrimary}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open &amp; Apply ↗
          </a>
        </div>
      </div>
      {assistMsg && (
        <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
          {assistMsg}
        </p>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
            {(["cover", "resume"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setShow(k)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  show === k
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500"
                }`}
              >
                {k === "cover" ? "Cover letter" : "Resume"}
              </button>
            ))}
          </div>
          <CopyButton text={text} label={`Copy ${show === "cover" ? "cover letter" : "resume"}`} />
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
          {text}
        </pre>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => onMark(item.id, "applied")}
          disabled={busy}
        >
          {busy ? "Saving…" : "Mark as applied"}
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => onMark(item.id, "skipped")}
          disabled={busy}
        >
          Skip
        </button>
      </div>
    </li>
  );
}
