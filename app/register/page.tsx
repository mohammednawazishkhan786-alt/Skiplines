"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getApiErrorMessage, parseApiResponse } from "@/lib/api-client";
import { DUPLICATE_EMAIL_MESSAGE } from "@/lib/otp";

type FormState = {
  doctor_name: string;
  clinic_name: string;
  email: string;
  avg_time_per_patient: string;
  consultation_fee: string;
  clinic_hours: string;
  google_review_link: string;
};

const initialForm: FormState = {
  doctor_name: "",
  clinic_name: "",
  email: "",
  avg_time_per_patient: "10",
  consultation_fee: "500",
  clinic_hours: "Mon-Sat 9:00 AM - 8:00 PM",
  google_review_link: "",
};

const OTP_SEND_ERROR =
  "Failed to send OTP. Please check server logs or try again.";
const OTP_VERIFY_ERROR =
  "Failed to verify OTP. Please check server logs or try again.";
const REGISTER_ERROR =
  "Registration failed. Please check server logs or try again.";

function validateForm(form: FormState) {
  if (!form.doctor_name.trim()) return "Doctor name is required.";
  if (!form.clinic_name.trim()) return "Clinic name is required.";
  if (!form.email.trim()) return "Email is required.";
  if (!form.clinic_hours.trim()) return "Clinic hours are required.";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "email") {
      setOtpSent(false);
      setOtp("");
      setDevOtp(null);
      setOtpMessage(null);
    }
  }

  async function handleSendOtp() {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
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
        body: JSON.stringify({ email: form.email }),
      });
      const payload = await parseApiResponse<{
        success?: boolean;
        error?: string;
        code?: string;
        message?: string;
        dev_otp?: string;
      }>(response, OTP_SEND_ERROR);

      if (!response.ok || payload.success === false) {
        if (payload.code === "TRIAL_ALREADY_USED") {
          setError(DUPLICATE_EMAIL_MESSAGE);
          return;
        }
        throw new Error(getApiErrorMessage(payload, OTP_SEND_ERROR));
      }

      setOtpSent(true);
      setOtpMessage(payload.message ?? "Email OTP sent.");
      if (payload.dev_otp) {
        setDevOtp(payload.dev_otp);
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : OTP_SEND_ERROR,
      );
    } finally {
      setOtpSending(false);
    }
  }

  async function registerClinic(verifiedSessionToken: string) {
    try {
      const response = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          doctor_name: form.doctor_name.trim(),
          clinic_name: form.clinic_name.trim(),
          email: form.email.trim(),
          avg_time_per_patient:
            Number(form.avg_time_per_patient) > 0
              ? Number(form.avg_time_per_patient)
              : 10,
          consultation_fee:
            Number(form.consultation_fee) > 0
              ? Number(form.consultation_fee)
              : 500,
          clinic_hours:
            form.clinic_hours.trim() || "Mon-Sat 9:00 AM - 8:00 PM",
          google_review_link: form.google_review_link.trim() || undefined,
          session_token: verifiedSessionToken,
        }),
      });

      const payload = await parseApiResponse<{
        success?: boolean;
        error?: string;
        code?: string;
        clinic?: { id: string };
      }>(response, REGISTER_ERROR);

      if (!response.ok || payload.success === false) {
        if (payload.code === "TRIAL_ALREADY_USED") {
          throw new Error(DUPLICATE_EMAIL_MESSAGE);
        }
        throw new Error(getApiErrorMessage(payload, REGISTER_ERROR));
      }

      const id = payload.clinic?.id;
      if (!id) {
        throw new Error(REGISTER_ERROR);
      }

      localStorage.setItem("skiplines_clinic_id", id);
      router.push("/dashboard");
    } catch (registerError) {
      throw registerError instanceof Error
        ? registerError
        : new Error(REGISTER_ERROR);
    }
  }

  async function handleVerifyOtp() {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!otpSent) {
      setError("Please send an email OTP first.");
      return;
    }

    setOtpVerifying(true);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: form.email, otp }),
      });
      const payload = await parseApiResponse<{
        success?: boolean;
        error?: string;
        verified?: boolean;
        session_token?: string;
        clinic_id?: string;
        logged_in?: boolean;
      }>(response, OTP_VERIFY_ERROR);

      if (!response.ok || payload.success === false) {
        throw new Error(getApiErrorMessage(payload, OTP_VERIFY_ERROR));
      }

      if (payload.logged_in && payload.clinic_id) {
        localStorage.setItem("skiplines_clinic_id", payload.clinic_id);
        router.push("/dashboard");
        return;
      }

      const token = payload.session_token;
      if (!token) {
        throw new Error(OTP_VERIFY_ERROR);
      }

      setOtpMessage("Email verified. Starting your 7-day free trial...");

      await registerClinic(token);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : OTP_VERIFY_ERROR,
      );
    } finally {
      setOtpVerifying(false);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-teal-950">Doctor Registration</h1>
          <p className="mt-2 text-teal-800/80">
            Verify your email to start a 7-day free trial. No payment required
            upfront — unlock full access with a one-time ₹999 payment after your
            trial ends.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleVerifyOtp();
          }}
          className="space-y-5 rounded-2xl border border-teal-200 bg-white p-8 shadow-sm"
        >
          <Field
            label="Doctor Name"
            id="doctor_name"
            value={form.doctor_name}
            onChange={(value) => updateField("doctor_name", value)}
            placeholder="Dr. Jane Smith"
            required
          />
          <Field
            label="Clinic Name"
            id="clinic_name"
            value={form.clinic_name}
            onChange={(value) => updateField("clinic_name", value)}
            placeholder="City Care Clinic"
            required
          />

          <div>
            <Field
              label="Gmail / Email Address"
              id="email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              placeholder="doctor@gmail.com"
              required
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                disabled={otpSending || loading || !form.email}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
              >
                {otpSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Email OTP...
                  </>
                ) : (
                  "Send OTP to Email"
                )}
              </button>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                className="flex-1 rounded-xl border border-teal-200 px-4 py-2 text-teal-950 outline-none ring-teal-500 focus:ring-2"
              />
            </div>
            {otpSent ? (
              <p className="mt-2 text-sm font-medium text-green-700">
                ✓ Email OTP sent — valid for 5 minutes
              </p>
            ) : null}
            {otpMessage ? (
              <p className="mt-2 text-sm text-teal-700">{otpMessage}</p>
            ) : null}
            {devOtp ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Development bypass — your OTP is <strong>{devOtp}</strong>
              </p>
            ) : null}
          </div>

          <Field
            label="Avg Time per Patient (minutes)"
            id="avg_time_per_patient"
            type="number"
            min={1}
            value={form.avg_time_per_patient}
            onChange={(value) => updateField("avg_time_per_patient", value)}
            required
          />
          <Field
            label="Consultation Fee (₹)"
            id="consultation_fee"
            type="number"
            min={1}
            value={form.consultation_fee}
            onChange={(value) => updateField("consultation_fee", value)}
            required
          />
          <Field
            label="Clinic Hours"
            id="clinic_hours"
            value={form.clinic_hours}
            onChange={(value) => updateField("clinic_hours", value)}
            placeholder="Mon-Sat 9:00 AM - 8:00 PM"
            required
          />
          <Field
            label="Google Review URL (optional)"
            id="google_review_link"
            value={form.google_review_link}
            onChange={(value) => updateField("google_review_link", value)}
            placeholder="https://g.page/r/your-clinic/review"
          />

          {error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || otpVerifying || !otpSent || otp.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading || otpVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loading ? "Creating your clinic..." : "Verifying Email OTP..."}
              </>
            ) : (
              "Verify OTP & Start 7-Day Free Trial"
            )}
          </button>

          <p className="text-center text-sm text-teal-800/70">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-teal-700 underline">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  required?: boolean;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-teal-900">
        {label}
      </span>
      <input
        id={id}
        type={type}
        min={min}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-teal-200 px-4 py-3 text-teal-950 outline-none ring-teal-500 focus:ring-2"
      />
    </label>
  );
}
