import type { Token } from "./types";
export const PUBLIC_TOKEN_SELECT =
  "id, clinic_id, token_number, queue_position, status, is_emergency, is_late, estimated_call_at, completed_at, late_shift_count, created_at" as const;

export type PublicToken = Pick<
  Token,
  | "id"
  | "clinic_id"
  | "token_number"
  | "queue_position"
  | "status"
  | "is_emergency"
  | "is_late"
  | "estimated_call_at"
  | "completed_at"
  | "late_shift_count"
  | "created_at"
>;

export function toPublicToken(
  entry: PublicToken & Partial<Pick<Token, "patient_phone" | "patient_name">>,
): PublicToken {
  return {
    id: entry.id,
    clinic_id: entry.clinic_id,
    token_number: entry.token_number,
    queue_position: entry.queue_position,
    status: entry.status,
    is_emergency: entry.is_emergency,
    is_late: entry.is_late,
    estimated_call_at: entry.estimated_call_at,
    completed_at: entry.completed_at,
    late_shift_count: entry.late_shift_count,
    created_at: entry.created_at,
  };
}
