"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

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

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          avg_time_per_patient: Number(form.avg_time_per_patient),
          consultation_fee: Number(form.consultation_fee),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Registration failed.");
      }

      const id = payload.clinic.id as string;
      setClinicId(id);
      localStorage.setItem("skiplines_clinic_id", id);

      await fetch("/api/razorpay/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: id }),
      }).catch(() => {
        // Subscription can be set up later from dashboard
      });

      const pdfResponse = await fetch(`/api/clinics/${id}/standee`);
      if (pdfResponse.ok) {
        const blob = await pdfResponse.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${form.clinic_name.replace(/\s+/g, "-").toLowerCase()}-whatsapp-standee.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong.",
      );
    } finally {
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
            Register your clinic to get a WhatsApp QR standee PDF and start
            managing your patient queue — no hardware needed.
          </p>
        </div>

        {clinicId ? (
          <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-teal-950">
              Registration successful
            </h2>
            <p className="mt-2 text-teal-800/80">
              Your WhatsApp QR standee PDF should have downloaded automatically.
              Patients scan it to get a token via WhatsApp — zero hardware
              required.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/api/clinics/${clinicId}/standee`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-600"
              >
                <Download className="h-4 w-4" />
                Download WhatsApp Standee
              </a>
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
            onSubmit={handleSubmit}
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
            <Field
              label="Phone (WhatsApp)"
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              placeholder="+91 98765 43210"
              required
            />
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
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register & Generate WhatsApp QR Standee"
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
