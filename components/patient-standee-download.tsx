"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { verifyClinicOwnership } from "@/lib/clinic-ownership";

type PatientStandeeDownloadProps = {
  clinicId: string;
  authenticatedClinicId: string;
  clinicName: string;
};

export function PatientStandeeDownload({
  clinicId,
  authenticatedClinicId,
  clinicName,
}: PatientStandeeDownloadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!verifyClinicOwnership(authenticatedClinicId, clinicId)) {
    return null;
  }

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clinics/${clinicId}/standee`, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        let message = "Could not download standee PDF.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Keep default message.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = clinicName.replace(/[^\w\-]+/g, "-").toLowerCase();
      link.href = url;
      link.download = `${safeName || "clinic"}-queue-standee.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download standee PDF.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-teal-950">Printable Standee</h2>
      <p className="mt-2 text-sm text-teal-800/80">
        Download an A4 PDF standee with your clinic QR code for the waiting
        area.
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing PDF...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download Standee PDF
          </>
        )}
      </button>
    </div>
  );
}
