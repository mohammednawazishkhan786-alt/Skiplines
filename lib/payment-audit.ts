import { createAdminClient } from "@/lib/supabase/admin";

export async function recordWebhookEvent(input: {
  eventId: string;
  eventType: string;
  clinicId?: string | null;
  providerOrderId?: string | null;
  payload?: unknown;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("webhook_events").insert({
    provider: "cashfree",
    event_id: input.eventId,
    event_type: input.eventType,
    clinic_id: input.clinicId ?? null,
    provider_order_id: input.providerOrderId ?? null,
    payload: input.payload ?? null,
  });

  if (error?.code === "23505") {
    return { duplicate: true as const };
  }

  if (error) {
    throw error;
  }

  return { duplicate: false as const };
}

export async function upsertPaymentTransaction(input: {
  clinicId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  status: string;
  eventType?: string;
  providerPaymentId?: string;
  rawPayload?: unknown;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("payment_transactions")
    .upsert(
      {
        clinic_id: input.clinicId,
        provider: "cashfree",
        provider_order_id: input.providerOrderId,
        provider_payment_id: input.providerPaymentId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        event_type: input.eventType ?? null,
        raw_payload: input.rawPayload ?? null,
        updated_at: now,
      },
      { onConflict: "provider,provider_order_id" },
    )
    .select("id, status")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
