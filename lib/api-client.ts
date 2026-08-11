type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  code?: string;
  message?: string;
};

export async function parseApiResponse<T extends ApiErrorPayload>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!raw.trim()) {
    if (!response.ok) {
      throw new Error(fallbackMessage);
    }
    return {} as T;
  }

  if (!contentType.includes("application/json")) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function getApiErrorMessage(
  payload: ApiErrorPayload | undefined,
  fallbackMessage: string,
) {
  return payload?.error ?? payload?.message ?? fallbackMessage;
}
