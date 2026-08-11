import { jsPDF } from "jspdf";
import QRCode from "qrcode";

type StandeeInput = {
  clinicName: string;
  doctorName: string;
  /** Canonical patient join URL (HTTP), not a public PII endpoint. */
  joinUrl: string;
};

export async function generateStandeePdf({
  clinicName,
  doctorName,
  joinUrl,
}: StandeeInput): Promise<ArrayBuffer> {
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 480,
    margin: 1,
    color: { dark: "#0f766e", light: "#ffffff" },
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 297, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text("Skiplines", 105, 42, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Digital OPD queue for clinics", 105, 52, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(clinicName, 105, 72, { align: "center", maxWidth: 170 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(`Dr. ${doctorName}`, 105, 84, { align: "center" });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(40, 98, 130, 130, 6, 6, "F");
  doc.addImage(qrDataUrl, "PNG", 50, 108, 110, 110);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Scan to join the queue", 105, 238, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Get your token instantly", 105, 248, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("No app download. No kiosk. Just scan on your phone.", 105, 258, {
    align: "center",
  });
  doc.text("Enter your name & WhatsApp number to join", 105, 266, {
    align: "center",
  });

  return doc.output("arraybuffer");
}
