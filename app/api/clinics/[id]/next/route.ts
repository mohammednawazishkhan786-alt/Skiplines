import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, current_token")
    .eq("id", id)
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }

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
    .select("id, token_number, status, created_at, patient_phone")
    .single();

  if (callError) {
    return NextResponse.json({ error: callError.message }, { status: 500 });
  }

  await supabase
    .from("clinics")
    .update({ current_token: nextPatient.token_number })
    .eq("id", id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (called.patient_phone) {
    const message = `🔔 It's your turn! Token #${called.token_number} — please proceed to the doctor's room now. Live tracker: ${appUrl}/live/${called.id}`;
    await sendWhatsAppMessage(called.patient_phone, message);
    await logNotification(id, called.id, called.patient_phone, "called", message);
  }

  return NextResponse.json({ patient: called });
}
