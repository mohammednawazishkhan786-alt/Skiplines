import { NextResponse } from "next/server";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { getClinicOrThrow, getSubscriptionAccessError } from "@/lib/clinic-access";
import { createClient } from "@/lib/supabase/server";
import { promoteEmergencyToken } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics/[id]/emergency",
  async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let entryId: string | undefined;
  try {
    const body = await request.json();
    entryId = body.entry_id;
  } catch {
    return NextResponse.json({ error: "entry_id is required." }, { status: 400 });
  }

  if (!entryId) {
    return NextResponse.json({ error: "entry_id is required." }, { status: 400 });
  }

  const { clinic, error: clinicLookupError } = await getClinicOrThrow(id);
  if (!clinic) {
    return NextResponse.json({ error: clinicLookupError }, { status: 404 });
  }

  const accessError = getSubscriptionAccessError(clinic);
  if (accessError) {
    return NextResponse.json({ error: accessError }, { status: 403 });
  }

  const supabase = await createClient();

  try {
    const entry = await promoteEmergencyToken(supabase, id, entryId);
    return NextResponse.json({ entry });
  } catch (error) {
    captureApiError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Emergency failed." },
      { status: 400 },
    );
  }
},
);
