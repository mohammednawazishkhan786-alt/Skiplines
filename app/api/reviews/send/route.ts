import { NextResponse } from "next/server";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { isAuthorizedJobRequest } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function handleReviewSend(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: entries, error } = await supabase
    .from("tokens")
    .select("id, clinic_id, token_number, patient_phone, completed_at, review_sent")
    .eq("status", "completed")
    .eq("review_sent", false)
    .not("completed_at", "is", null)
    .lte("completed_at", thirtyMinutesAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const entry of entries ?? []) {
    if (!entry.patient_phone) continue;

    const { data: clinic } = await supabase
      .from("clinics")
      .select("google_review_link, clinic_name")
      .eq("id", entry.clinic_id)
      .single();

    const reviewUrl = clinic?.google_review_link?.trim();
    if (!reviewUrl) {
      continue;
    }

    const message = `Thank you for visiting ${clinic?.clinic_name ?? "our clinic"}! 🌟 We'd love your feedback. Please leave us a Google review: ${reviewUrl}`;

    const success = await sendWhatsAppMessage(entry.patient_phone, message);
    if (!success) continue;

    await supabase
      .from("tokens")
      .update({ review_sent: true })
      .eq("id", entry.id);

    await logNotification(
      entry.clinic_id,
      entry.id,
      entry.patient_phone,
      "google_review",
      message,
    );

    sent += 1;
  }

  return NextResponse.json({ sent, total: entries?.length ?? 0 });
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/reviews/send",
  handleReviewSend,
);

export const GET = withSentryApiRoute(
  "GET",
  "/api/reviews/send",
  handleReviewSend,
);
