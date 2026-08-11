import { NextResponse } from "next/server";
import { requireDoctorSubscription } from "@/lib/subscription-guard";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withSentryApiRoute(
  "GET",
  "/api/clinics/[id]",
  async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const access = await requireDoctorSubscription(request, id);
  if (access instanceof Response) {
    return access;
  }

  const supabase = await createClient();

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", id)
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }

  const { data: waiting, error: waitingError } = await supabase
    .from("tokens")
    .select("*")
    .eq("clinic_id", id)
    .eq("status", "waiting")
    .order("queue_position", { ascending: true });

  if (waitingError) {
    return NextResponse.json({ error: waitingError.message }, { status: 500 });
  }

  const { data: called, error: calledError } = await supabase
    .from("tokens")
    .select("*")
    .eq("clinic_id", id)
    .eq("status", "called")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (calledError) {
    return NextResponse.json({ error: calledError.message }, { status: 500 });
  }

  return NextResponse.json({
    clinic,
    waiting: waiting ?? [],
    currentlyServing: called,
  });
},
);
