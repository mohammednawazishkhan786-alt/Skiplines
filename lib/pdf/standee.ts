import { jsPDF } from "jspdf";
import QRCode from "qrcode";

type StandeeInput = {
  clinicName: string;
  doctorName: string;
  whatsAppUrl: string;
};

export async function generateStandeePdf({
  clinicName,
  doctorName,
  whatsAppUrl,
}: StandeeInput): Promise<ArrayBuffer> {
  const qrDataUrl = await QRCode.toDataURL(whatsAppUrl, {
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
  doc.text("Zero hardware. WhatsApp queue.", 105, 52, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(clinicName, 105, 72, { align: "center", maxWidth: 170 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(`Dr. ${doctorName}`, 105, 84, { align: "center" });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(40, 98, 130, 130, 6, 6, "F");
  doc.addImage(qrDataUrl, "PNG", 50, 108, 110, 110);

  doc.setTextColor(37, 211, 102);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Scan with WhatsApp", 105, 238, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Get your token instantly", 105, 248, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("No app download. No kiosk. Just scan & chat.", 105, 258, {
    align: "center",
  });
  doc.text("Message TOKEN to join the live queue", 105, 266, { align: "center" });

  return doc.output("arraybuffer");
}
