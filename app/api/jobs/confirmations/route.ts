import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/env";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { isAuthorizedJobRequest } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

export const POST = withSentryApiRoute(
  "POST",
  "/api/jobs/confirmations",
  async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
  const appUrl = getPublicAppUrl();

  const { data: entries, error } = await supabase
    .from("tokens")
    .select("id, clinic_id, token_number, patient_phone, estimated_call_at")
    .eq("status", "waiting")
    .eq("confirmation_sent", false)
    .not("estimated_call_at", "is", null)
    .lte("estimated_call_at", fifteenMinutesFromNow.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const entry of entries ?? []) {
    if (!entry.patient_phone) continue;

    const message = `⏰ Reminder: Your appointment (Token #${entry.token_number}) is in ~15 minutes. Please confirm you're on your way or tap "I'm 10 Mins Late" on your live tracker: ${appUrl}/live/${entry.id}`;

    const success = await sendWhatsAppMessage(entry.patient_phone, message);
    if (!success) continue;

    await supabase
      .from("tokens")
      .update({ confirmation_sent: true, confirmed_at: now.toISOString() })
      .eq("id", entry.id);

    await logNotification(
      entry.clinic_id,
      entry.id,
      entry.patient_phone,
      "confirmation_15min",
      message,
    );

    sent += 1;
  }

  return NextResponse.json({ sent, total: entries?.length ?? 0 });
},
);
