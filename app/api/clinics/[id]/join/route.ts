import { NextResponse } from "next/server";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { getClinicOrThrow, getSubscriptionAccessError } from "@/lib/clinic-access";
import { createClient } from "@/lib/supabase/server";
import { createQueueEntry } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics/[id]/join",
  async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  let patientPhone: string | undefined;
  let patientName: string | undefined;
  let isEmergency = false;

  try {
    const body = await request.json();
    patientPhone = body.patient_phone;
    patientName = body.patient_name;
    isEmergency = Boolean(body.is_emergency);
  } catch {
    // Optional body
  }

  const { clinic, error: clinicLookupError } = await getClinicOrThrow(id);
  if (!clinic) {
    return NextResponse.json({ error: clinicLookupError }, { status: 404 });
  }

  const accessError = getSubscriptionAccessError(clinic);
  if (accessError) {
    return NextResponse.json({ error: accessError }, { status: 403 });
  }

  try {
    const entry = await createQueueEntry(supabase, clinic, {
      patientPhone,
      patientName,
      isEmergency,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    captureApiError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Join failed." },
      { status: 500 },
    );
  }
},
);
