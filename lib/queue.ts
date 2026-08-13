import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clinic, Token } from "@/lib/types";
import { isUniqueViolationError } from "@/lib/clinic-registration";
import {
  normalizePhone,
  queuePatientPhoneLookupVariants,
} from "@/lib/phone";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/env";

export type CreateQueueEntryResult = {
  entry: Token;
  existing: boolean;
};

export function normalizeQueuePatientPhone(
  phone?: string | null,
): string | null {
  if (phone === undefined || phone === null) {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  return normalizePhone(trimmed);
}

export function isExistingQueueEntry(
  entry: Pick<Token, "id" | "created_at">,
  requestedAtMs: number,
  preExisting: Pick<Token, "id"> | null,
): boolean {
  if (preExisting && preExisting.id === entry.id) {
    return true;
  }

  return new Date(entry.created_at).getTime() < requestedAtMs - 100;
}

export async function findWaitingTokenByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  patientPhone: string,
): Promise<Token | null> {
  const lookupPhones = queuePatientPhoneLookupVariants(patientPhone);
  if (lookupPhones.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .in("patient_phone", lookupPhones)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Token | null) ?? null;
}

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
  } = {},
): Promise<CreateQueueEntryResult> {
  const patientPhone = normalizeQueuePatientPhone(options.patientPhone);
  const patientName = options.patientName?.trim() || null;
  const requestedAtMs = Date.now();
  let preExistingBeforeRpc: Token | null = null;

  if (patientPhone) {
    preExistingBeforeRpc = await findWaitingTokenByPhone(
      supabase,
      clinic.id,
      patientPhone,
    );
    if (preExistingBeforeRpc) {
      return { entry: preExistingBeforeRpc, existing: true };
    }
  }

  // Prefer DB-atomic RPC (advisory lock) when migration 017+ is applied.
  const { data: rpcEntry, error: rpcError } = await supabase.rpc(
    "join_queue_atomic",
    {
      p_clinic_id: clinic.id,
      p_patient_name: patientName,
      p_patient_phone: patientPhone,
      p_is_emergency: false,
      p_avg_time_per_patient: clinic.avg_time_per_patient,
    },
  );

  if (!rpcError && rpcEntry) {
    const entry = rpcEntry as Token;
    return {
      entry,
      existing: isExistingQueueEntry(entry, requestedAtMs, preExistingBeforeRpc),
    };
  }

  if (rpcError && !isUniqueViolationError(rpcError)) {
    // Fallback path for environments where RPC is not yet applied.
    return createQueueEntryLegacy(supabase, clinic, {
      patientPhone: patientPhone ?? undefined,
      patientName: patientName ?? undefined,
      requestedAtMs,
    });
  }

  if (rpcError && patientPhone) {
    const recovered = await findWaitingTokenByPhone(
      supabase,
      clinic.id,
      patientPhone,
    );
    if (recovered) {
      return { entry: recovered, existing: true };
    }
  }

  if (rpcError) {
    throw new Error(rpcError.message ?? "Failed to create queue entry.");
  }

  return createQueueEntryLegacy(supabase, clinic, {
    patientPhone: patientPhone ?? undefined,
    patientName: patientName ?? undefined,
    requestedAtMs,
  });
}

async function createQueueEntryLegacy(
  supabase: SupabaseClient,
  clinic: Clinic,
  options: {
    patientPhone?: string;
    patientName?: string;
    requestedAtMs: number;
  },
): Promise<CreateQueueEntryResult> {
  const patientPhone = normalizeQueuePatientPhone(options.patientPhone);
  const patientName = options.patientName?.trim() || null;

  if (patientPhone) {
    const preExisting = await findWaitingTokenByPhone(
      supabase,
      clinic.id,
      patientPhone,
    );
    if (preExisting) {
      return { entry: preExisting, existing: true };
    }
  }

  const { data: lastEntry } = await supabase
    .from("tokens")
    .select("token_number")
    .eq("clinic_id", clinic.id)
    .order("token_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextToken = (lastEntry?.token_number ?? 0) + 1;
  const queuePosition = await getNextQueuePosition(supabase, clinic.id);

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
      patient_phone: patientPhone,
      patient_name: patientName,
      is_emergency: false,
      estimated_call_at: estimatedCallAt,
    })
    .select()
    .single();

  if (error) {
    if (isUniqueViolationError(error) && patientPhone) {
      const recovered = await findWaitingTokenByPhone(
        supabase,
        clinic.id,
        patientPhone,
      );
      if (recovered) {
        return { entry: recovered, existing: true };
      }
    }

    throw new Error(error.message ?? "Failed to create queue entry.");
  }

  if (!entry) {
    throw new Error("Failed to create queue entry.");
  }

  return {
    entry: entry as Token,
    existing: isExistingQueueEntry(
      entry as Token,
      options.requestedAtMs,
      null,
    ),
  };
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
