"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { openCashfreeSubscriptionCheckout } from "@/lib/cashfree-checkout";
import { DUPLICATE_PHONE_MESSAGE } from "@/lib/otp";

type FormState = {
  doctor_name: string;
  clinic_name: string;
  email: string;
  phone: string;
  avg_time_per_patient: string;
  consultation_fee: string;
  clinic_hours: string;
  google_review_link: string;
};

type Step = "form" | "mandate" | "complete";

const initialForm: FormState = {
  doctor_name: "",
  clinic_name: "",
  email: "",
  phone: "",
  avg_time_per_patient: "10",
  consultation_fee: "500",
  clinic_hours: "Mon-Sat 9:00 AM - 8:00 PM",
  google_review_link: "",
};

function validateForm(form: FormState) {
  if (!form.doctor_name.trim()) return "Doctor name is required.";
  if (!form.clinic_name.trim()) return "Clinic name is required.";
  if (!form.email.trim()) return "Email is required.";
  if (!form.phone.trim()) return "WhatsApp mobile number is required.";
  if (!form.clinic_hours.trim()) return "Clinic hours are required.";
  return null;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "phone") {
      setOtpSent(false);
      setSessionToken(null);
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
        body: JSON.stringify({ phone: form.phone }),
      });
      const payload = await response.json();

      if (!response.ok) {
        if (payload.code === "TRIAL_ALREADY_USED") {
          setError(DUPLICATE_PHONE_MESSAGE);
          return;
        }
        throw new Error(payload.error ?? "Could not send WhatsApp OTP.");
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
          : "Could not send WhatsApp OTP.",
      );
    } finally {
      setOtpSending(false);
    }
  }

  async function downloadStandee(id: string) {
    const pdfResponse = await fetch(`/api/clinics/${id}/standee`);
    if (!pdfResponse.ok) return;

    const blob = await pdfResponse.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${form.clinic_name.replace(/\s+/g, "-").toLowerCase()}-whatsapp-standee.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function startMandateCheckout(id: string) {
    const subscriptionResponse = await fetch("/api/cashfree/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic_id: id }),
    });
    const subscriptionPayload = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      throw new Error(
        subscriptionPayload.error ?? "Could not start Cashfree mandate checkout.",
      );
    }

    if (!subscriptionPayload.subscription_session_id) {
      throw new Error(
        "Cashfree did not return a subscription session. Please try again.",
      );
    }

    await openCashfreeSubscriptionCheckout(
      subscriptionPayload.subscription_session_id,
    );
  }

  async function completeRegistrationAfterOtp(verifiedSessionToken: string) {
    const validationError = validateForm(form);
    if (validationError) {
      throw new Error(validationError);
    }

    setLoading(true);
    setStep("mandate");
    setError(null);

    try {
      const response = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          session_token: verifiedSessionToken,
          avg_time_per_patient: Number(form.avg_time_per_patient),
          consultation_fee: Number(form.consultation_fee),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload.code === "TRIAL_ALREADY_USED") {
          setError(DUPLICATE_PHONE_MESSAGE);
          return;
        }
        throw new Error(payload.error ?? "Registration failed.");
      }

      const id = payload.clinic.id as string;
      setClinicId(id);
      localStorage.setItem("skiplines_clinic_id", id);

      await startMandateCheckout(id);
      await downloadStandee(id);
      setStep("complete");
    } catch (submitError) {
      setStep("form");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Registration failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!otpSent) {
      setError("Please send a WhatsApp OTP first.");
      return;
    }

    setOtpVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, otp }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "OTP verification failed.");
      }

      const token = payload.session_token as string;
      setSessionToken(token);
      setOtpMessage("WhatsApp verified. Opening ₹1 UPI mandate checkout...");

      await completeRegistrationAfterOtp(token);
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
      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-teal-950">Doctor Registration</h1>
          <p className="mt-2 text-teal-800/80">
            Verify your WhatsApp number, then authorize a ₹1 UPI mandate to
            start your 7-day free trial.
          </p>
        </div>

        {step === "complete" && clinicId ? (
          <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-teal-950">
              Registration submitted
            </h2>
            <p className="mt-2 text-teal-800/80">
              Complete the ₹1 UPI mandate in the Cashfree popup. Your trial
              activates only after mandate authorization is confirmed. Your
              WhatsApp standee uses your registered number:{" "}
              <strong>{form.phone}</strong>.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void downloadStandee(clinicId)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-600"
              >
                <Download className="h-4 w-4" />
                Download WhatsApp Standee
              </button>
              <button
                type="button"
                onClick={() => void startMandateCheckout(clinicId)}
                className="inline-flex items-center justify-center rounded-xl border border-teal-200 px-5 py-3 font-medium text-teal-800 hover:bg-teal-50"
              >
                Re-open ₹1 Mandate Checkout
              </button>
              <Link
                href={`/dashboard?clinic=${clinicId}`}
                className="inline-flex items-center justify-center rounded-xl border border-teal-200 px-5 py-3 font-medium text-teal-800 hover:bg-teal-50"
              >
                Open Dashboard
              </Link>
            </div>
          </div>
        ) : (
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
            <Field
              label="Email"
              id="email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              placeholder="doctor@clinic.com"
              required
            />

            <div>
              <Field
                label="Phone (WhatsApp)"
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(value) => updateField("phone", value)}
                placeholder="Enter your 10-digit WhatsApp number"
                required
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  disabled={otpSending || loading || !form.phone}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
                >
                  {otpSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending WhatsApp OTP...
                    </>
                  ) : (
                    "Send WhatsApp OTP"
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
                  ✓ WhatsApp OTP sent — valid for 5 minutes
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
                  {loading
                    ? "Opening Cashfree ₹1 mandate..."
                    : "Verifying WhatsApp OTP..."}
                </>
              ) : (
                "Verify OTP & Authorize ₹1 UPI Mandate"
              )}
            </button>
          </form>
        )}
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
