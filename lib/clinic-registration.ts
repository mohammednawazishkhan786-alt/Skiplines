import { randomUUID } from "node:crypto";

export const CLINIC_ID_MAX_INSERT_ATTEMPTS = 5;

export const POSTGRES_UNIQUE_VIOLATION = "23505";

export function generateSecureClinicId() {
  return randomUUID();
}

export function isUniqueViolationError(
  error: { code?: string } | null | undefined,
) {
  return error?.code === POSTGRES_UNIQUE_VIOLATION;
}

type ClinicInsertRow = Record<string, unknown>;

type InsertAttemptResult<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

export async function insertClinicWithUniqueId<T>(
  insertFn: (
    clinicId: string,
    row: ClinicInsertRow,
  ) => Promise<InsertAttemptResult<T>>,
  row: ClinicInsertRow,
  maxAttempts = CLINIC_ID_MAX_INSERT_ATTEMPTS,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const clinicId = generateSecureClinicId();
    const { data, error } = await insertFn(clinicId, row);

    if (!error && data) {
      return { data, error: null, clinicId };
    }

    if (error && !isUniqueViolationError(error)) {
      return { data: null, error, clinicId: null };
    }
  }

  return {
    data: null,
    error: { message: "Could not allocate a unique clinic ID." },
    clinicId: null,
  };
}
