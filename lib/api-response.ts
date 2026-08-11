import { NextResponse } from "next/server";

export function apiError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export async function parseJsonBody(request: Request) {
  try {
    return { ok: true as const, body: await request.json() };
  } catch {
    return { ok: false as const };
  }
}
