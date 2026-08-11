"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setOtpSending(true);
    setError(null);
    setOtpMessage(null);
    setDevOtp(null);

    try {
      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send email OTP.");
      }

      setOtpSent(true);
      setOtpMessage(payload.message);
      if (payload.dev_otp) {
        setDevOtp(payload.dev_otp);
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send email OTP.",
      );
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    if (!otpSent) {
      setError("Please send an email OTP first.");
      return;
    }

    setOtpVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: trimmedEmail, otp }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "OTP verification failed.");
      }

      if (!payload.logged_in || !payload.clinic_id) {
        throw new Error(
          "No clinic found for this email. Please register your clinic first.",
        );
      }

      localStorage.setItem("skiplines_clinic_id", payload.clinic_id);
      router.push("/dashboard");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "OTP verification failed.",
      );
    } finally {
      setOtpVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-teal-950">Doctor Sign In</h1>
          <p className="mt-2 text-teal-800/80">
            Verify your Gmail or email address to open your clinic dashboard.
          </p>
        </div>

        <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
          <label className="block text-sm font-medium text-teal-900">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setOtpSent(false);
              setOtp("");
              setDevOtp(null);
              setOtpMessage(null);
            }}
            placeholder="doctor@gmail.com"
            className="mt-2 w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500"
          />

          <button
            type="button"
            onClick={() => void handleSendOtp()}
            disabled={otpSending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-3 font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
          >
            {otpSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send OTP to Email"
            )}
          </button>

          {otpMessage ? (
            <p className="mt-3 text-sm text-teal-700">{otpMessage}</p>
          ) : null}
          {devOtp ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Dev OTP: <strong>{devOtp}</strong>
            </p>
          ) : null}

          {otpSent ? (
            <div className="mt-6 border-t border-teal-100 pt-6">
              <label className="block text-sm font-medium text-teal-900">
                6-digit OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter OTP from your inbox"
                className="mt-2 w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none focus:border-teal-500"
              />

              <button
                type="button"
                onClick={() => void handleVerifyOtp()}
                disabled={otpVerifying || otp.length !== 6}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {otpVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Sign In to Dashboard"
                )}
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-sm text-teal-800/80">
          New clinic?{" "}
          <Link href="/register" className="font-medium text-teal-700 underline">
            Register here
          </Link>
        </p>
      </main>
    </div>
  );
}
