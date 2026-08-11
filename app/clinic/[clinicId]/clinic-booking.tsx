"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Ticket } from "lucide-react";
import { INVALID_PHONE_MESSAGE, isValidIndianMobile } from "@/lib/phone";
import { buildLiveTrackerUrl } from "@/lib/public-urls";

type ClinicBookingProps = {
  clinicId: string;
  clinicName: string;
  doctorName: string;
};

export function ClinicBooking({
  clinicId,
  clinicName,
  doctorName,
}: ClinicBookingProps) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
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
    <div className="w-full max-w-md rounded-3xl border border-teal-200 bg-white p-8 text-center shadow-sm">
      <Ticket className="mx-auto h-10 w-10 text-teal-700" />
      <p className="mt-4 text-sm font-medium uppercase tracking-wide text-teal-600">
        {clinicName}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-teal-950">
        Dr. {doctorName}
      </h1>
      <p className="mt-3 text-teal-800/80">
        Enter your name and WhatsApp number to get your token.
      </p>

      <div className="mt-6 space-y-4 text-left">
        <label className="block" htmlFor="clinic-join-name">
          <span className="mb-1.5 block text-sm font-medium text-teal-900">
            Your Name
          </span>
          <input
            id="clinic-join-name"
            type="text"
            autoComplete="name"
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            placeholder="Patient name"
            maxLength={80}
            className="w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500"
          />
        </label>
        <label className="block" htmlFor="clinic-join-phone">
          <span className="mb-1.5 block text-sm font-medium text-teal-900">
            WhatsApp / Mobile Number
          </span>
          <input
            id="clinic-join-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={patientPhone}
            onChange={(event) =>
              setPatientPhone(event.target.value.replace(/[^\d+\s-]/g, "").slice(0, 15))
            }
            placeholder="10-digit Indian mobile"
            className="w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-describedby="clinic-join-phone-hint"
          />
          <span id="clinic-join-phone-hint" className="mt-1 block text-xs text-teal-700/70">
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
        disabled={loading}
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
    </div>
  );
}
