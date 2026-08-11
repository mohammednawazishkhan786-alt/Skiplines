"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { INVALID_PHONE_MESSAGE, isValidIndianMobile } from "@/lib/phone";
import { buildLiveTrackerUrl } from "@/lib/public-urls";

export default function JoinPage() {
  const params = useParams<{ clinicId: string }>();
  const clinicId = params.clinicId;
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [token, setToken] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!clinicId) return;

    const name = patientName.trim();
    if (!name || name.length < 2) {
      setError("Enter your full name.");
      return;
    }

    if (!isValidIndianMobile(patientPhone)) {
      setError(INVALID_PHONE_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: name,
          patient_phone: patientPhone.trim(),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not join queue.");
      }

      setToken(payload.entry.token_number);
      setEntryId(payload.entry.id);
      window.location.assign(buildLiveTrackerUrl(payload.entry.id));
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
          Enter your name and WhatsApp number to get your token.
        </p>

        {token ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl bg-teal-700 px-6 py-10 text-white">
              <p className="text-sm uppercase tracking-wide text-teal-100">
                Your Token
              </p>
              <p className="mt-2 text-6xl font-bold">#{token}</p>
              <p className="mt-4 text-sm text-teal-100">
                Redirecting to your live tracker...
              </p>
            </div>
            {entryId ? (
              <a
                href={buildLiveTrackerUrl(entryId)}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-teal-200 px-6 py-4 font-semibold text-teal-800 hover:bg-teal-50"
              >
                Open Live Tracker
              </a>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 text-left">
              <label className="block" htmlFor="join-name">
                <span className="mb-1.5 block text-sm font-medium text-teal-900">
                  Your Name
                </span>
                <input
                  id="join-name"
                  type="text"
                  autoComplete="name"
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  placeholder="Patient name"
                  maxLength={80}
                  className="w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500"
                />
              </label>
              <label className="block" htmlFor="join-phone">
                <span className="mb-1.5 block text-sm font-medium text-teal-900">
                  WhatsApp / Mobile Number
                </span>
                <input
                  id="join-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={patientPhone}
                  onChange={(event) =>
                    setPatientPhone(event.target.value.replace(/[^\d+\s-]/g, "").slice(0, 15))
                  }
                  placeholder="10-digit Indian mobile"
                  className="w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500"
                  aria-describedby="join-phone-hint"
                />
                <span id="join-phone-hint" className="mt-1 block text-xs text-teal-700/70">
                  Used only to notify you when it is your turn.
                </span>
              </label>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={loading || !clinicId}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-6 py-4 text-lg font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
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
