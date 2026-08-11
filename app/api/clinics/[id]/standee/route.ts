import { NextResponse } from "next/server";
import { requireDoctorSubscription } from "@/lib/subscription-guard";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { generateStandeePdf } from "@/lib/pdf/standee";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPatientQrUrl } from "@/lib/patient-qr";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withSentryApiRoute(
  "GET",
  "/api/clinics/[id]/standee",
  async function GET(request: Request, context: RouteContext) {
    const { id } = await context.params;

    const access = await requireDoctorSubscription(request, id);
    if (access instanceof Response) {
      return access;
    }

    const supabase = createAdminClient();

    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("id, clinic_name, doctor_name")
      .eq("id", id)
      .single();

    if (error || !clinic) {
      return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    }

    // Standee QR uses the same patient join URL as the dashboard QR (privacy-safe HTTP join).
    const joinUrl = buildPatientQrUrl(clinic.id);

    const pdfBuffer = await generateStandeePdf({
      clinicName: clinic.clinic_name,
      doctorName: clinic.doctor_name,
      joinUrl,
    });

    const filename = `${clinic.clinic_name.replace(/\s+/g, "-").toLowerCase()}-queue-standee.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
