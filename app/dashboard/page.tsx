"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  CreditCard,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import type { Clinic, QueueEntry } from "@/lib/types";

type DashboardData = {
  clinic: Clinic;
  waiting: QueueEntry[];
  currentlyServing: QueueEntry | null;
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("clinic");
    const fromStorage =
      typeof window !== "undefined"
        ? localStorage.getItem("skiplines_clinic_id")
        : null;
    setClinicId(fromQuery ?? fromStorage);
  }, [searchParams]);

  const loadDashboard = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load dashboard.");
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadDashboard();
    const interval = setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  async function handleCallNext() {
    if (!clinicId) return;

    setCalling(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/next`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not call next patient.");
      }

      setMessage(`Now serving token #${payload.patient.token_number}`);
      await loadDashboard();
    } catch (callError) {
      setError(
        callError instanceof Error
          ? callError.message
          : "Could not call next patient.",
      );
    } finally {
      setCalling(false);
    }
  }

  async function handleEmergency(entryId: string) {
    if (!clinicId) return;

    setEmergencyId(entryId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Emergency override failed.");
      }

      setMessage(
        `Emergency priority set for token #${payload.entry.token_number}. Waiting patients notified.`,
      );
      await loadDashboard();
    } catch (emergencyError) {
      setError(
        emergencyError instanceof Error
          ? emergencyError.message
          : "Emergency override failed.",
      );
    } finally {
      setEmergencyId(null);
    }
  }

  async function handleSubscribe() {
    if (!clinicId) return;

    setSubscribing(true);
    setError(null);

    try {
      const response = await fetch("/api/razorpay/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Subscription failed.");
      }

      if (payload.short_url) {
        window.open(payload.short_url, "_blank");
      }

      setMessage(
        `Subscription created — ₹999/month with 7-day free trial. Status: ${payload.status}`,
      );
      await loadDashboard();
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Subscription failed.",
      );
    } finally {
      setSubscribing(false);
    }
  }

  if (!clinicId) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white p-8 text-center shadow-sm">
        <p className="text-teal-800">
          No clinic selected. Register first or open your dashboard link.
        </p>
        <Link
          href="/register"
          className="mt-4 inline-block rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-600"
        >
          Register Clinic
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-teal-700">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { clinic, waiting, currentlyServing } = data;
  const estimatedWait = waiting.length * clinic.avg_time_per_patient;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-600">
          {clinic.clinic_name}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-teal-950">
          Dr. {clinic.doctor_name}
        </h1>
        <p className="mt-2 text-teal-800/80">
          Avg. {clinic.avg_time_per_patient} min per patient · Fee ₹
          {clinic.consultation_fee}
        </p>
        <p className="mt-1 text-sm text-teal-700">
          Subscription: {clinic.subscription_status}
          {clinic.trial_ends_at
            ? ` · Trial ends ${new Date(clinic.trial_ends_at).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Now Serving"
          value={
            currentlyServing ? `#${currentlyServing.token_number}` : "—"
          }
          icon={<BellRing className="h-5 w-5" />}
        />
        <StatCard
          label="Waiting"
          value={String(waiting.length)}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Est. Wait"
          value={`${estimatedWait} min`}
          icon={<RefreshCw className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
        <button
          type="button"
          onClick={() => void handleCallNext()}
          disabled={calling || waiting.length === 0}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-teal-700 px-6 py-5 text-lg font-bold tracking-wide text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {calling ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Calling...
            </>
          ) : (
            <>
              <BellRing className="h-5 w-5" />
              CALL NEXT PATIENT
            </>
          )}
        </button>

        {!clinic.razorpay_subscription_id ? (
          <button
            type="button"
            onClick={() => void handleSubscribe()}
            disabled={subscribing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 px-5 py-3 font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
          >
            {subscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Subscribe — ₹999/month (7-day free trial)
          </button>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-center font-medium text-teal-800">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-teal-950">Waiting Queue</h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-teal-800/70">No patients waiting.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {waiting.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  entry.is_emergency
                    ? "border-red-300 bg-red-50"
                    : "border-teal-100 bg-teal-50"
                }`}
              >
                <div>
                  <span className="font-semibold text-teal-900">
                    #{entry.token_number}
                  </span>
                  {entry.is_emergency ? (
                    <span className="ml-2 text-xs font-medium uppercase text-red-600">
                      Emergency
                    </span>
                  ) : null}
                  {entry.patient_phone ? (
                    <p className="text-xs text-teal-700">{entry.patient_phone}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/live/${entry.id}`}
                    className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-white"
                  >
                    Live
                  </Link>
                  {!entry.is_emergency ? (
                    <button
                      type="button"
                      onClick={() => void handleEmergency(entry.id)}
                      disabled={emergencyId === entry.id}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      {emergencyId === entry.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      Emergency
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-teal-600">{icon}</div>
      <p className="mt-3 text-sm text-teal-700">{label}</p>
      <p className="text-2xl font-bold text-teal-950">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24 text-teal-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
