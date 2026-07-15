"use client"; // error boundaries must be client components

import { useEffect } from "react";

/**
 * Route-level error boundary: a thrown server action or render error shows
 * this friendly fallback instead of Next's raw crash screen. Nothing is lost —
 * jobs, applications, and the profile live on disk.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Something went wrong
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t worry — your profile, found jobs, and prepared applications are all saved on
        this computer. This is usually a temporary hiccup (like a dropped internet connection).
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Try again
      </button>
    </div>
  );
}
