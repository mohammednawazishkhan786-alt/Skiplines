import { NextResponse } from "next/server";
import { enforceRateLimit, ipKey } from "@/lib/api-rate-limit";
import { getPublicAppUrl } from "@/lib/env";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { notifyWaitingPatientsOfShift, shiftTokenLate } from "@/lib/queue";
import { toPublicToken } from "@/lib/public-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{ tokenId: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/queue/[tokenId]/late",
  async function POST(request: Request, context: RouteContext) {
  const { tokenId } = await context.params;

  const rateLimited = await enforceRateLimit(
    request,
    `${ipKey(request, "late")}:token:${tokenId}`,
    { windowMs: 5 * 60_000, max: 3 },
  );
  if (rateLimited) {
    return rateLimited;
  }

  const supabase = createAdminClient();

  try {
    const entry = await shiftTokenLate(supabase, tokenId);
    await notifyWaitingPatientsOfShift(supabase, entry.clinic_id, entry.id);

    if (entry.patient_phone) {
      const appUrl = getPublicAppUrl();
      const message = `✅ Your token #${entry.token_number} has been shifted back 2 slots. New estimated wait updated. Track live: ${appUrl}/live/${entry.id}`;
      await sendWhatsAppMessage(entry.patient_phone, message);
      await logNotification(
        entry.clinic_id,
        entry.id,
        entry.patient_phone,
        "late_shift",
        message,
      );
    }

    return NextResponse.json({ entry: toPublicToken(entry) });
  } catch (error) {
    captureApiError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Late shift failed." },
      { status: 400 },
    );
  }
},
);
