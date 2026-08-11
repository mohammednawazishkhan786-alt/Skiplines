"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Clinic, QueueEntry } from "@/lib/types";

type LiveData = {
  entry: QueueEntry;
  clinic: Clinic;
  currentToken: number;
  positionInQueue: number;
  estimatedWaitMinutes: number;
};

export default function LiveTrackerPage() {
  const params = useParams<{ token_id: string }>();
  const tokenId = params.token_id;
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shifting, setShifting] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tokenId) return;

    try {
      const response = await fetch(`/api/queue/${tokenId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load tracker.");
      }

      setData(payload);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load.",
      );
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    if (!tokenId) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        void loadData();
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [tokenId, loadData]);

  useEffect(() => {
    if (!data?.entry.clinic_id) return;

    const supabase = createClient();
    const clinicId = data.entry.clinic_id;

    const channel = supabase
      .channel(`live-${tokenId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tokens",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clinics",
          filter: `id=eq.${clinicId}`,
        },
        () => {
          void loadData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.entry.clinic_id, tokenId, loadData]);

  async function handleLateShift() {
    if (!tokenId) return;
    setShifting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/queue/${tokenId}/late`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not shift token.");
      }

      setMessage("Your token has been shifted back 2 slots.");
      await loadData();
    } catch (shiftError) {
      setError(
        shiftError instanceof Error ? shiftError.message : "Shift failed.",
      );
    } finally {
      setShifting(false);
    }
  }

  async function handleEmergency() {
    if (!data) return;
    setEmergencyLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/queue/${tokenId}/emergency`,
        { method: "POST" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Emergency request failed.");
      }

      setMessage("Emergency priority activated. You are next in line.");
      await loadData();
    } catch (emergencyError) {
      setError(
        emergencyError instanceof Error
          ? emergencyError.message
          : "Emergency request failed.",
      );
    } finally {
      setEmergencyLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50 text-teal-700">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50 px-6">
        <p className="rounded-xl bg-red-50 px-6 py-4 text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { entry, clinic, currentToken, positionInQueue, estimatedWaitMinutes } =
    data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white px-6 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-600">
            {clinic.clinic_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-teal-950">
            Live Queue Tracker
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TrackerCard
            label="Current Token"
            value={currentToken > 0 ? `#${currentToken}` : "—"}
            icon={<Ticket className="h-5 w-5" />}
            highlight
          />
          <TrackerCard
            label="Your Token"
            value={`#${entry.token_number}`}
            icon={<Ticket className="h-5 w-5" />}
            emergency={entry.is_emergency}
          />
        </div>

        <TrackerCard
          label="Estimated Wait Time"
          value={
            entry.status === "called"
              ? "Your turn now!"
              : entry.status === "completed"
                ? "Visit completed"
                : `${estimatedWaitMinutes} min`
          }
          icon={<Clock className="h-5 w-5" />}
          fullWidth
        />

        {entry.status === "waiting" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleLateShift()}
              disabled={shifting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-4 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {shifting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Clock className="h-5 w-5" />
              )}
              I am 10 Mins Late
            </button>

            <button
              type="button"
              onClick={() => void handleEmergency()}
              disabled={emergencyLoading || entry.is_emergency}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-4 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {emergencyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              Emergency Priority
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void loadData()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>

        {positionInQueue > 0 && entry.status === "waiting" ? (
          <p className="text-center text-sm text-teal-700">
            {positionInQueue} patient{positionInQueue === 1 ? "" : "s"} ahead of
            you
          </p>
        ) : null}

        {message ? (
          <p className="rounded-xl bg-teal-50 px-4 py-3 text-center text-sm font-medium text-teal-800">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TrackerCard({
  label,
  value,
  icon,
  highlight,
  emergency,
  fullWidth,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
  emergency?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        fullWidth ? "col-span-2" : ""
      } ${
        highlight
          ? "border-teal-300 bg-teal-700 text-white"
          : emergency
            ? "border-red-300 bg-red-50"
            : "border-teal-200 bg-white"
      }`}
    >
      <div
        className={`flex items-center gap-2 ${highlight ? "text-teal-100" : "text-teal-600"}`}
      >
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p
        className={`mt-2 text-3xl font-bold ${highlight ? "text-white" : "text-teal-950"}`}
      >
        {value}
      </p>
    </div>
  );
}
