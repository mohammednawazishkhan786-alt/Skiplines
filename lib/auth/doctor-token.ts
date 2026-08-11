import { createHmac, timingSafeEqual } from "node:crypto";

export const DOCTOR_TOKEN_COOKIE = "doctor_token";
export const DOCTOR_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type DoctorTokenPayload = {
  clinicId: string;
  exp: number;
};

function isProduction() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function getDoctorAuthSecret(): string {
  const secret = process.env.DOCTOR_AUTH_SECRET?.trim();

  if (isProduction()) {
    if (!secret || secret.startsWith("your_")) {
      throw new Error(
        "DOCTOR_AUTH_SECRET must be set in production. Generate a long random string.",
      );
    }
    return secret;
  }

  if (secret && !secret.startsWith("your_")) {
    return secret;
  }

  return "skiplines_dev_doctor_auth_secret_change_me";
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getDoctorAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createDoctorToken(clinicId: string) {
  const payload: DoctorTokenPayload = {
    clinicId,
    exp: Date.now() + DOCTOR_TOKEN_MAX_AGE_SECONDS * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyDoctorToken(token: string): DoctorTokenPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(encodedPayload);
  } catch {
    return null;
  }

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as DoctorTokenPayload;

    if (!payload.clinicId || !payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getDoctorTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === DOCTOR_TOKEN_COOKIE) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export function verifyDoctorAuth(request: Request, clinicId: string) {
  const token = getDoctorTokenFromRequest(request);
  if (!token) {
    return false;
  }

  const payload = verifyDoctorToken(token);
  return payload?.clinicId === clinicId;
}
