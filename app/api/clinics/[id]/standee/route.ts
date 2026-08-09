import { NextResponse } from "next/server";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { generateStandeePdf } from "@/lib/pdf/standee";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppTokenUrl } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withSentryApiRoute(
  "GET",
  "/api/clinics/[id]/standee",
  async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("id, clinic_name, doctor_name, whatsapp_number, phone")
    .eq("id", id)
    .single();

  if (error || !clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }

  const clinicWhatsApp = clinic.whatsapp_number ?? clinic.phone;
  const whatsAppUrl = buildWhatsAppTokenUrl(clinic.id, clinicWhatsApp);

  const pdfBuffer = await generateStandeePdf({
    clinicName: clinic.clinic_name,
    doctorName: clinic.doctor_name,
    whatsAppUrl,
  });

  const filename = `${clinic.clinic_name.replace(/\s+/g, "-").toLowerCase()}-whatsapp-standee.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
},
);
