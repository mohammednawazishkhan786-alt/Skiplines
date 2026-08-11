"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Avoid logging PII — digest only.
    console.error("[dashboard]", error.digest ?? "error");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-teal-950">
        Dashboard unavailable
      </h1>
      <p className="mt-2 text-sm text-teal-800/80">
        Something went wrong loading your clinic dashboard. Please try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="rounded-full border border-teal-200 px-5 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50"
        >
          Sign in again
        </Link>
      </div>
    </div>
  );
}
