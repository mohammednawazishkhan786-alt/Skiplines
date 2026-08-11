"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import QRCode from "qrcode";
import { isValidClinicId } from "@/lib/clinic-identity";
import { verifyClinicOwnership } from "@/lib/clinic-ownership";
import { buildPatientQrUrl } from "@/lib/patient-qr";

type PatientQrCodeProps = {
  clinicId: string;
  authenticatedClinicId: string;
  clinicName: string;
  doctorName: string;
};

export function PatientQrCode({
  clinicId,
  authenticatedClinicId,
  clinicName,
  doctorName,
}: PatientQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patientUrl = useMemo(() => {
    if (!isValidClinicId(clinicId)) {
      return null;
    }

    try {
      return buildPatientQrUrl(clinicId);
    } catch {
      return null;
    }
  }, [clinicId]);

  useEffect(() => {
    if (!patientUrl) {
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(patientUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f766e", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setError("Could not generate QR code. Please refresh the page.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientUrl]);

  function handleDownload() {
    if (!qrDataUrl || !clinicId) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `skiplines-patient-qr-${clinicId}.png`;
    link.click();
  }

  function handlePrint() {
    if (!qrDataUrl || !patientUrl) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Pop-up blocked. Allow pop-ups to print the QR code.");
      return;
    }

    const safeClinicName = clinicName.replace(/</g, "&lt;");
    const safeDoctorName = doctorName.replace(/</g, "&lt;");

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Skiplines Patient QR</title>
    <style>
      @page { size: A4 portrait; margin: 20mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
        color: #134e4a;
        text-align: center;
        padding: 24px;
      }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 22px; font-weight: 600; margin: 0 0 12px; color: #0f766e; }
      .clinic { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
      .doctor { font-size: 16px; margin: 0 0 28px; color: #475569; }
      img { width: 280px; height: 280px; }
      p { margin-top: 24px; font-size: 14px; color: #475569; word-break: break-all; }
    </style>
  </head>
  <body>
    <h1>Scan to Book Appointment</h1>
    <h2>Skiplines</h2>
    <p class="clinic">${safeClinicName}</p>
    <p class="doctor">Dr. ${safeDoctorName}</p>
    <img src="${qrDataUrl}" alt="Patient QR Code" />
    <p>${patientUrl}</p>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  if (!verifyClinicOwnership(authenticatedClinicId, clinicId)) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        Clinic ownership could not be verified. Sign in again to view your QR
        code.
      </div>
    );
  }

  if (!isValidClinicId(clinicId)) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        Clinic ID is missing or invalid. Sign in again or contact support.
      </div>
    );
  }

  if (!patientUrl) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        Could not build a valid patient QR URL for this clinic.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-teal-950">Patient QR Code</h2>
      <p className="mt-2 text-teal-800/80">
        Scan this QR code to book an appointment at your clinic.
      </p>

      <div className="mt-6 flex flex-col items-center">
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR is generated client-side as a data URL.
          <img
            src={qrDataUrl}
            alt="Patient QR Code"
            width={256}
            height={256}
            className="h-64 w-64 max-w-full rounded-xl border border-teal-100 bg-white p-2"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-teal-100 bg-teal-50">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        )}

        <p className="mt-4 text-center text-base font-semibold text-teal-950">
          {clinicName}
        </p>
        <p className="text-center text-sm text-teal-800/80">
          Dr. {doctorName}
        </p>
        <p className="mt-3 break-all text-center text-xs text-teal-700/80">
          {patientUrl}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Download QR
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-4 w-4" />
          Print QR
        </button>
      </div>
    </div>
  );
}
