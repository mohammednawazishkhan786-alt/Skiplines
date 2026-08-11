import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/env";
import { requireDoctorSubscription } from "@/lib/subscription-guard";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics/[id]/next",
  async function POST(request: Request, context: RouteContext) {
    const { id } = await context.params;

    const access = await requireDoctorSubscription(request, id);
    if (access instanceof Response) {
      return access;
    }

    const supabase = createAdminClient();

    // Prefer atomic RPC (advisory lock) when migration 017 is applied.
    const { data: rpcPatient, error: rpcError } = await supabase.rpc(
      "call_next_patient_atomic",
      { p_clinic_id: id },
    );

    if (!rpcError && rpcPatient) {
      const called = rpcPatient as {
        id: string;
        token_number: number;
        status: string;
        created_at: string;
        patient_phone: string | null;
      };

      const appUrl = getPublicAppUrl();
      if (called.patient_phone) {
        const message = `🔔 It's your turn! Token #${called.token_number} — please proceed to the doctor's room now. Live tracker: ${appUrl}/live/${called.id}`;
        await sendWhatsAppMessage(called.patient_phone, message);
        await logNotification(
          id,
          called.id,
          called.patient_phone,
          "called",
          message,
        );
      }

      return NextResponse.json({ patient: called });
    }

    if (rpcError?.message?.includes("NO_WAITING_PATIENTS")) {
      return NextResponse.json(
        { error: "No patients waiting in the queue." },
        { status: 404 },
      );
    }

    // Fallback path (pre-017 environments)
    const { data: currentlyServing } = await supabase
      .from("tokens")
      .select("id, patient_phone, token_number")
      .eq("clinic_id", id)
      .eq("status", "called")
      .maybeSingle();

    if (currentlyServing) {
      const completedAt = new Date().toISOString();
      await supabase
        .from("tokens")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", currentlyServing.id);
    }

    const { data: nextPatient, error: nextError } = await supabase
      .from("tokens")
      .select("id, token_number, patient_phone")
      .eq("clinic_id", id)
      .eq("status", "waiting")
      .order("queue_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) {
      return NextResponse.json({ error: nextError.message }, { status: 500 });
    }

    if (!nextPatient) {
      return NextResponse.json(
        { error: "No patients waiting in the queue." },
        { status: 404 },
      );
    }

    const { data: called, error: callError } = await supabase
      .from("tokens")
      .update({ status: "called" })
      .eq("id", nextPatient.id)
      .eq("status", "waiting")
      .select("id, token_number, status, created_at, patient_phone")
      .maybeSingle();

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 });
    }

    if (!called) {
      return NextResponse.json(
        { error: "Could not call next patient. Please try again." },
        { status: 409 },
      );
    }

    await supabase
      .from("clinics")
      .update({ current_token: nextPatient.token_number })
      .eq("id", id);

    const appUrl = getPublicAppUrl();

    if (called.patient_phone) {
      const message = `🔔 It's your turn! Token #${called.token_number} — please proceed to the doctor's room now. Live tracker: ${appUrl}/live/${called.id}`;
      await sendWhatsAppMessage(called.patient_phone, message);
      await logNotification(id, called.id, called.patient_phone, "called", message);
    }

    return NextResponse.json({ patient: called });
  },
);
