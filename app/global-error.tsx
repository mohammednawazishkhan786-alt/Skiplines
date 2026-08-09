"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold text-teal-950">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-teal-800/80">
            An unexpected error occurred. Please refresh the page or try again
            later.
          </p>
        </main>
      </body>
    </html>
  );
}
