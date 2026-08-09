"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";

export default function JoinPage() {
  const params = useParams<{ clinicId: string }>();
  const clinicId = params.clinicId;
  const [token, setToken] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!clinicId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/join`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not join queue.");
      }

      setToken(payload.entry.token_number);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Could not join queue.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white px-6">
      <div className="w-full max-w-md rounded-3xl border border-teal-200 bg-white p-8 text-center shadow-sm">
        <Ticket className="mx-auto h-10 w-10 text-teal-700" />
        <h1 className="mt-4 text-2xl font-bold text-teal-950">Join the Queue</h1>
        <p className="mt-2 text-teal-800/80">
          Tap below to get your token number. No sign-up needed.
        </p>

        {token ? (
          <div className="mt-8 rounded-2xl bg-teal-700 px-6 py-10 text-white">
            <p className="text-sm uppercase tracking-wide text-teal-100">
              Your Token
            </p>
            <p className="mt-2 text-6xl font-bold">#{token}</p>
            <p className="mt-4 text-sm text-teal-100">
              Please wait in the waiting area. We&apos;ll call your number soon.
            </p>
          </div>
        ) : (
          <>
            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={loading || !clinicId}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-6 py-4 text-lg font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Booking...
                </>
              ) : (
                "Book Token"
              )}
            </button>
            <p className="mt-2 text-center text-xs text-teal-800/60">
              By clicking Book Token, you agree to Skiplines&apos;{" "}
              <Link href="/terms" className="underline hover:text-teal-700">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-teal-700">
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
