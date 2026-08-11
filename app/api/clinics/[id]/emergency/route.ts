import { NextResponse } from "next/server";
import { requireDoctorSubscription } from "@/lib/subscription-guard";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteEmergencyToken } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics/[id]/emergency",
  async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const access = await requireDoctorSubscription(request, id);
  if (access instanceof Response) {
    return access;
  }

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

  const supabase = createAdminClient();

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
