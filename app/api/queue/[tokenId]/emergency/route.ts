import { NextResponse } from "next/server";
import { enforceRateLimit, ipKey } from "@/lib/api-rate-limit";
import { getClinicOrThrow, getSubscriptionAccessError } from "@/lib/clinic-access";
import { promoteEmergencyToken } from "@/lib/queue";
import { toPublicToken } from "@/lib/public-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

type RouteContext = {
  params: Promise<{ tokenId: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/queue/[tokenId]/emergency",
  async function POST(request: Request, context: RouteContext) {
    const { tokenId } = await context.params;

    const rateLimited = await enforceRateLimit(
      request,
      `${ipKey(request, "emergency")}:token:${tokenId}`,
      { windowMs: 60 * 60_000, max: 2 },
    );
    if (rateLimited) {
      return rateLimited;
    }

    const supabase = createAdminClient();

    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("id, clinic_id, status, is_emergency")
      .eq("id", tokenId)
      .single();

    if (tokenError || !token) {
      return NextResponse.json({ error: "Token not found." }, { status: 404 });
    }

    if (token.id !== tokenId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    if (token.status !== "waiting") {
      return NextResponse.json(
        { error: "Only waiting patients can request emergency priority." },
        { status: 400 },
      );
    }

    if (token.is_emergency) {
      return NextResponse.json(
        { error: "Emergency priority is already active for this token." },
        { status: 400 },
      );
    }

    const { clinic, error: clinicLookupError } = await getClinicOrThrow(
      token.clinic_id,
    );
    if (!clinic) {
      return NextResponse.json({ error: clinicLookupError }, { status: 404 });
    }

    const accessError = getSubscriptionAccessError(clinic);
    if (accessError) {
      return NextResponse.json({ error: accessError }, { status: 403 });
    }

    try {
      const entry = await promoteEmergencyToken(
        supabase,
        token.clinic_id,
        tokenId,
      );
      return NextResponse.json({ entry: toPublicToken(entry) });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Emergency failed." },
        { status: 400 },
      );
    }
  },
);
