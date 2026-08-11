import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicAppUrl } from "@/lib/env";
import type { Clinic, Token } from "@/lib/types";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

export async function getNextQueuePosition(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<number> {
  const { data } = await supabase
    .from("tokens")
    .select("queue_position")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .order("queue_position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.queue_position ?? 0) + 1;
}

export async function createQueueEntry(
  supabase: SupabaseClient,
  clinic: Clinic,
  options: {
    patientPhone?: string;
    patientName?: string;
    isEmergency?: boolean;
  } = {},
): Promise<Token> {
  // Prefer DB-atomic RPC (advisory lock) when migration 017 is applied.
  const { data: rpcEntry, error: rpcError } = await supabase.rpc(
    "join_queue_atomic",
    {
      p_clinic_id: clinic.id,
      p_patient_name: options.patientName ?? null,
      p_patient_phone: options.patientPhone ?? null,
      p_is_emergency: options.isEmergency ?? false,
      p_avg_time_per_patient: clinic.avg_time_per_patient,
    },
  );

  if (!rpcError && rpcEntry) {
    return rpcEntry as Token;
  }

  // Fallback path for environments where RPC is not yet applied.
  return createQueueEntryLegacy(supabase, clinic, options);
}

async function createQueueEntryLegacy(
  supabase: SupabaseClient,
  clinic: Clinic,
  options: {
    patientPhone?: string;
    patientName?: string;
    isEmergency?: boolean;
  },
): Promise<Token> {
  const { data: lastEntry } = await supabase
    .from("tokens")
    .select("token_number")
    .eq("clinic_id", clinic.id)
    .order("token_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextToken = (lastEntry?.token_number ?? 0) + 1;
  let queuePosition = await getNextQueuePosition(supabase, clinic.id);

  if (options.isEmergency) {
    const { data: waiting } = await supabase
      .from("tokens")
      .select("id, queue_position")
      .eq("clinic_id", clinic.id)
      .eq("status", "waiting")
      .order("queue_position", { ascending: true });

    if (waiting && waiting.length > 0) {
      queuePosition = waiting[0].queue_position;
      for (const entry of waiting) {
        await supabase
          .from("tokens")
          .update({ queue_position: entry.queue_position + 1 })
          .eq("id", entry.id);
      }
    } else {
      queuePosition = 1;
    }
  }

  const { count: waitingAhead } = await supabase
    .from("tokens")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("status", "waiting");

  const positionAhead = waitingAhead ?? 0;
  const estimatedCallAt = new Date(
    Date.now() + positionAhead * clinic.avg_time_per_patient * 60_000,
  ).toISOString();

  const { data: entry, error } = await supabase
    .from("tokens")
    .insert({
      clinic_id: clinic.id,
      token_number: nextToken,
      queue_position: queuePosition,
      status: "waiting",
      patient_phone: options.patientPhone ?? null,
      patient_name: options.patientName ?? null,
      is_emergency: options.isEmergency ?? false,
      estimated_call_at: estimatedCallAt,
    })
    .select()
    .single();

  if (error || !entry) {
    throw new Error(error?.message ?? "Failed to create queue entry.");
  }

  return entry as Token;
}

export async function shiftTokenLate(
  supabase: SupabaseClient,
  entryId: string,
): Promise<Token> {
  const { data: entry, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error || !entry) {
    throw new Error("Token not found.");
  }

  if (entry.status !== "waiting") {
    throw new Error("Only waiting patients can shift their token.");
  }

  const { data: waiting } = await supabase
    .from("tokens")
    .select("id, queue_position")
    .eq("clinic_id", entry.clinic_id)
    .eq("status", "waiting")
    .order("queue_position", { ascending: true });

  if (!waiting || waiting.length === 0) {
    throw new Error("Queue not found.");
  }

  const currentIndex = waiting.findIndex((item) => item.id === entryId);
  if (currentIndex === -1) {
    throw new Error("Token not in waiting queue.");
  }

  const targetIndex = Math.min(currentIndex + 2, waiting.length - 1);
  if (targetIndex === currentIndex) {
    throw new Error("Cannot shift further back.");
  }

  const reordered = [...waiting];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  for (let index = 0; index < reordered.length; index += 1) {
    await supabase
      .from("tokens")
      .update({ queue_position: index + 1 })
      .eq("id", reordered[index].id);
  }

  const { data: updated, error: updateError } = await supabase
    .from("tokens")
    .update({
      is_late: true,
      late_shift_count: (entry.late_shift_count ?? 0) + 1,
      estimated_call_at: new Date(
        Date.now() + targetIndex * 10 * 60_000,
      ).toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to shift token.");
  }

  return updated as Token;
}

export async function promoteEmergencyToken(
  supabase: SupabaseClient,
  clinicId: string,
  entryId: string,
): Promise<Token> {
  const { data: entry } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", entryId)
    .eq("clinic_id", clinicId)
    .single();

  if (!entry) {
    throw new Error("Token not found.");
  }

  const { data: waiting } = await supabase
    .from("tokens")
    .select("id, queue_position, patient_phone")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .order("queue_position", { ascending: true });

  if (!waiting || waiting.length === 0) {
    throw new Error("No waiting patients.");
  }

  const minPosition = waiting[0].queue_position;

  for (const item of waiting) {
    if (item.id !== entryId) {
      await supabase
        .from("tokens")
        .update({ queue_position: item.queue_position + 1 })
        .eq("id", item.id);
    }
  }

  const { data: updated, error } = await supabase
    .from("tokens")
    .update({
      is_emergency: true,
      queue_position: minPosition,
      estimated_call_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "Emergency promotion failed.");
  }

  const appUrl = getPublicAppUrl();

  for (const item of waiting) {
    if (item.id === entryId || !item.patient_phone) continue;

    const message = `⚠️ Queue update at your clinic: An emergency case has been prioritized. Your wait may be slightly longer. Track live: ${appUrl}/live/${item.id}`;
    await sendWhatsAppMessage(item.patient_phone, message);
    await logNotification(clinicId, item.id, item.patient_phone, "emergency_shift", message);
  }

  return updated as Token;
}

export async function notifyWaitingPatientsOfShift(
  supabase: SupabaseClient,
  clinicId: string,
  excludeEntryId: string,
) {
  const { data: waiting } = await supabase
    .from("tokens")
    .select("id, patient_phone, token_number")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .neq("id", excludeEntryId);

  const appUrl = getPublicAppUrl();

  for (const entry of waiting ?? []) {
    if (!entry.patient_phone) continue;
    const message = `Queue update: A patient shifted back. Your position may have improved. Token #${entry.token_number}. Live: ${appUrl}/live/${entry.id}`;
    await sendWhatsAppMessage(entry.patient_phone, message);
    await logNotification(clinicId, entry.id, entry.patient_phone, "queue_shift", message);
  }
}

export function calculateEstimatedWait(
  positionInQueue: number,
  avgTimePerPatient: number,
): number {
  return Math.max(0, positionInQueue) * avgTimePerPatient;
}
