import { NextResponse } from "next/server";
import { enforceRateLimit, ipKey } from "@/lib/api-rate-limit";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { getClinicOrThrow, getSubscriptionAccessError } from "@/lib/clinic-access";
import {
  INVALID_PHONE_MESSAGE,
  isValidIndianMobile,
  normalizePhone,
} from "@/lib/phone";
import { toPublicToken } from "@/lib/public-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createQueueEntry } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics/[id]/join",
  async function POST(request: Request, context: RouteContext) {
    const { id } = await context.params;

    const rateLimited = await enforceRateLimit(
      request,
      `${ipKey(request, "join")}:clinic:${id}`,
      { windowMs: 60_000, max: 20 },
    );
    if (rateLimited) {
      return rateLimited;
    }

    let patientPhoneRaw = "";
    let patientNameRaw = "";

    try {
      const body = await request.json();
      patientPhoneRaw = String(body.patient_phone ?? "");
      patientNameRaw = String(body.patient_name ?? "");
      // Public joins must never accept client-supplied emergency priority.
    } catch {
      return NextResponse.json(
        { error: "Request body with patient_name and patient_phone is required." },
        { status: 400 },
      );
    }

    const patientName = patientNameRaw.trim();
    if (!patientName || patientName.length < 2 || patientName.length > 80) {
      return NextResponse.json(
        { error: "Enter your full name (2–80 characters)." },
        { status: 400 },
      );
    }

    if (!isValidIndianMobile(patientPhoneRaw)) {
      return NextResponse.json({ error: INVALID_PHONE_MESSAGE }, { status: 400 });
    }

    const patientPhone = normalizePhone(patientPhoneRaw);

    const { clinic, error: clinicLookupError } = await getClinicOrThrow(id);
    if (!clinic) {
      return NextResponse.json({ error: clinicLookupError }, { status: 404 });
    }

    const accessError = getSubscriptionAccessError(clinic);
    if (accessError) {
      return NextResponse.json({ error: accessError }, { status: 403 });
    }

    const supabase = createAdminClient();

    try {
      const entry = await createQueueEntry(supabase, clinic, {
        patientPhone,
        patientName,
        isEmergency: false,
      });

      return NextResponse.json({ entry: toPublicToken(entry) }, { status: 201 });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Join failed." },
        { status: 500 },
      );
    }
  },
);
