import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createQueueEntry } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  let patientPhone: string | undefined;
  let patientName: string | undefined;
  let isEmergency = false;

  try {
    const body = await request.json();
    patientPhone = body.patient_phone;
    patientName = body.patient_name;
    isEmergency = Boolean(body.is_emergency);
  } catch {
    // Optional body
  }

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", id)
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }

  try {
    const entry = await createQueueEntry(supabase, clinic, {
      patientPhone,
      patientName,
      isEmergency,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Join failed." },
      { status: 500 },
    );
  }
}
