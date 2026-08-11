import { NextResponse } from "next/server";
import {
  createDoctorToken,
  DOCTOR_TOKEN_COOKIE,
  DOCTOR_TOKEN_MAX_AGE_SECONDS,
  getDoctorAuthSecret,
  getDoctorTokenFromRequest,
  verifyDoctorAuth,
  verifyDoctorToken,
} from "@/lib/auth/doctor-token";

export {
  createDoctorToken,
  DOCTOR_TOKEN_COOKIE,
  DOCTOR_TOKEN_MAX_AGE_SECONDS,
  getDoctorAuthSecret,
  getDoctorTokenFromRequest,
  verifyDoctorAuth,
  verifyDoctorToken,
};

export function unauthorizedDoctorResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireDoctorAuth(request: Request, clinicId: string) {
  if (!verifyDoctorAuth(request, clinicId)) {
    return unauthorizedDoctorResponse();
  }

  return null;
}

export function setDoctorTokenCookie(response: NextResponse, clinicId: string) {
  const token = createDoctorToken(clinicId);

  response.cookies.set(DOCTOR_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DOCTOR_TOKEN_MAX_AGE_SECONDS,
  });

  return response;
}

export function clearDoctorTokenCookie(response: NextResponse) {
  response.cookies.set(DOCTOR_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
