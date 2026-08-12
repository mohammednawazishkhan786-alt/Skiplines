"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BellRing,
  CreditCard,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { verifyClinicOwnership } from "@/lib/clinic-ownership";
import { PatientQrCode } from "@/components/patient-qr-code";
import { PatientStandeeDownload } from "@/components/patient-standee-download";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import {
  cleanDashboardPath,
  cleanDashboardUrl,
  hasPaymentReturnParams,
  sanitizeCashfreeErrorMessage,
  STRIP_PAYMENT_QUERY_KEYS,
} from "@/lib/cashfree-navigation";
import {
  getTrialDaysRemaining,
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  shouldSkipCashfreePaymentFlow,
} from "@/lib/subscription";
import type { Clinic, QueueEntry } from "@/lib/types";

type DashboardData = {
  clinic: Clinic;
  waiting: QueueEntry[];
  currentlyServing: QueueEntry | null;
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resolvingSession, setResolvingSession] = useState(true);
  const verifiedPaymentRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let dirty = false;

    for (const key of STRIP_PAYMENT_QUERY_KEYS) {
      if (params.has(key)) {
        params.delete(key);
        dirty = true;
      }
    }

    if (!dirty) {
      return;
    }

    const clinic = params.get("clinic") ?? clinicId;
    router.replace(cleanDashboardPath(clinic), { scroll: false });
  }, [searchParams, clinicId, router]);

  useEffect(() => {
    let cancelled = false;

    async function resolveClinicId() {
      const fromQuery = searchParams.get("clinic");
      const fromStorage =
        typeof window !== "undefined"
          ? localStorage.getItem("skiplines_clinic_id")
          : null;

      try {
        const sessionResponse = await fetch("/api/auth/me", {
          credentials: "same-origin",
        });

        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (!cancelled && session.clinic_id) {
            localStorage.setItem("skiplines_clinic_id", session.clinic_id);
            setClinicId(fromQuery ?? session.clinic_id);
            setResolvingSession(false);
            return;
          }
        }
      } catch {
        // Fall back to stored clinic id below.
      }

      if (!cancelled) {
        setClinicId(fromQuery ?? fromStorage);
        setResolvingSession(false);
      }
    }

    void resolveClinicId();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const loadDashboard = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}`, {
        credentials: "same-origin",
      });
      const payload = await response.json();

      if (response.status === 401) {
        throw new Error(
          "Your session expired. Sign in with email OTP on the login page.",
        );
      }

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

  const verifyPayment = useCallback(
    async (orderId: string) => {
      if (!clinicId) return;

      setVerifyingPayment(true);
      setMessage(null);
      setError(null);

      try {
        const response = await fetch("/api/cashfree/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ clinic_id: clinicId, order_id: orderId }),
        });
        const raw = await response.text();
        let payload: { error?: string; message?: string; skipped?: boolean } =
          {};

        if (raw) {
          try {
            payload = JSON.parse(raw) as {
              error?: string;
              message?: string;
              skipped?: boolean;
            };
          } catch {
            throw new Error("Payment verification failed. Please try again.");
          }
        }

        if (!response.ok) {
          throw new Error(
            sanitizeCashfreeErrorMessage(
              payload.error ?? "Payment verification failed.",
            ),
          );
        }

        if (!payload.skipped) {
          setMessage(
            payload.message ??
              "Payment successful — Skiplines unlocked for 1 month.",
          );
          await loadDashboard();
        }

        router.replace(cleanDashboardPath(clinicId), { scroll: false });
      } catch (verifyError) {
        setError(
          sanitizeCashfreeErrorMessage(
            verifyError instanceof Error
              ? verifyError.message
              : "Payment verification failed.",
          ),
        );
        router.replace(cleanDashboardPath(clinicId), { scroll: false });
      } finally {
        setVerifyingPayment(false);
      }
    },
    [clinicId, loadDashboard, router],
  );

  useEffect(() => {
    if (!data?.clinic || !clinicId) {
      return;
    }

    if (shouldSkipCashfreePaymentFlow(data.clinic)) {
      if (hasPaymentReturnParams(searchParams)) {
        router.replace(cleanDashboardPath(clinicId), { scroll: false });
      }
      return;
    }

    if (!hasPaymentReturnParams(searchParams)) {
      return;
    }

    const orderId = searchParams.get("order_id")?.trim();
    if (!orderId) {
      router.replace(cleanDashboardPath(clinicId), { scroll: false });
      return;
    }

    if (verifiedPaymentRef.current === orderId) {
      return;
    }

    verifiedPaymentRef.current = orderId;
    void verifyPayment(orderId);
  }, [data, searchParams, clinicId, verifyPayment, router]);

  useEffect(() => {
    let active = true;

    const runLoad = () => {
      if (!active) {
        return;
      }
      void loadDashboard();
    };

    const initialTimeoutId = window.setTimeout(runLoad, 0);
    const interval = window.setInterval(runLoad, 5000);

    return () => {
      active = false;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  async function handleCallNext() {
    if (!clinicId) return;

    setCalling(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/next`, {
        method: "POST",
        credentials: "same-origin",
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

  async function handleUnlockPayment() {
    if (!clinicId) return;

    setPaying(true);
    setError(null);

    try {
      const response = await fetch("/api/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clinic_id: clinicId }),
      });
      const raw = await response.text();
      let payload: {
        success?: boolean;
        error?: string;
        payment_session_id?: string;
        cashfree_mode?: "sandbox" | "production";
        return_url?: string;
        order_id?: string;
      } = {};

      if (raw) {
        try {
          payload = JSON.parse(raw) as typeof payload;
        } catch {
          throw new Error("Could not start payment. Please try again.");
        }
      }

      if (!response.ok || payload.success === false) {
        throw new Error(
          sanitizeCashfreeErrorMessage(
            payload.error ?? "Could not start payment.",
          ),
        );
      }

      if (!payload.payment_session_id?.trim()) {
        throw new Error("Cashfree did not return a payment session.");
      }

      if (payload.cashfree_mode !== "production") {
        throw new Error("Live payments require Cashfree production mode.");
      }

      await openCashfreeCheckout(
        payload.payment_session_id.trim(),
        payload.return_url ??
          `${cleanDashboardUrl(clinicId)}&order_id=${payload.order_id}`,
        payload.cashfree_mode,
      );
    } catch (payError) {
      setError(
        sanitizeCashfreeErrorMessage(
          payError instanceof Error ? payError.message : "Payment failed.",
        ),
      );
    } finally {
      setPaying(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      localStorage.removeItem("skiplines_clinic_id");
      router.push("/login");
    } catch {
      setError("Could not sign out. Please try again.");
      setLoggingOut(false);
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

  if (resolvingSession || (loading && !data)) {
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
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-block rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-600"
          >
            Sign in with Email OTP
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { clinic, waiting, currentlyServing } = data;
  const estimatedWait = waiting.length * clinic.avg_time_per_patient;
  const dashboardAccess = hasDashboardAccess(clinic);
  const onTrial = isTrialActive(clinic) && !isPaidSubscriptionActive(clinic);
  const trialDaysLeft = getTrialDaysRemaining(clinic);
  const paidActive = isPaidSubscriptionActive(clinic);
  const bannerError = error ? sanitizeCashfreeErrorMessage(error) : null;
  const bannerMessage = message;

  return (
    <div className="space-y-6">
      {verifyingPayment ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-3 text-center text-sm font-medium text-teal-800">
          Confirming your payment...
        </div>
      ) : null}

      {onTrial ? (
        <div className="rounded-xl border border-teal-200 bg-teal-700 px-5 py-3 text-center text-sm font-medium text-white">
          7-Day Free Trial Active — {trialDaysLeft} day
          {trialDaysLeft === 1 ? "" : "s"} left
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>

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
          {paidActive
            ? `Active until ${new Date(clinic.subscription_expires_at!).toLocaleDateString()}`
            : onTrial
              ? `Free trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining`
              : `Status: ${clinic.subscription_status}`}
        </p>
      </div>

      {!dashboardAccess ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-amber-950">
            Your free trial has ended
          </h2>
          <p className="mt-2 text-amber-900/80">
            Pay ₹999 to unlock Skiplines queue management for 1 month.
          </p>
          <button
            type="button"
            onClick={() => void handleUnlockPayment()}
            disabled={paying}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening payment...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay ₹999 to Unlock Skiplines for 1 Month
              </>
            )}
          </button>
        </div>
      ) : null}

      {dashboardAccess ? (
        <>
      {dashboardAccess &&
      verifyClinicOwnership(clinicId, data.clinic.id) ? (
        <>
          <PatientQrCode
            key={clinic.id}
            clinicId={clinic.id}
            authenticatedClinicId={clinicId}
            clinicName={clinic.clinic_name}
            doctorName={clinic.doctor_name}
          />
          <PatientStandeeDownload
            clinicId={clinic.id}
            authenticatedClinicId={clinicId}
            clinicName={clinic.clinic_name}
          />
        </>
      ) : null}

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

        {bannerMessage ? (
          <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-center font-medium text-teal-800">
            {bannerMessage}
          </p>
        ) : null}

        {bannerError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {bannerError}
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
                className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 px-4 py-3"
              >
                <div>
                  <span className="font-semibold text-teal-900">
                    #{entry.token_number}
                  </span>
                  {entry.patient_phone ? (
                    <p className="text-xs text-teal-700">{entry.patient_phone}</p>
                  ) : null}
                </div>
                <Link
                  href={`/live/${entry.id}`}
                  className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-white"
                >
                  Live
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      ) : null}
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
