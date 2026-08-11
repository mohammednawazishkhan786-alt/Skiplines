import { NextResponse } from "next/server";
import { PUBLIC_CLINIC_SELECT, toPublicClinic } from "@/lib/public-clinic";
import { PUBLIC_TOKEN_SELECT, toPublicToken } from "@/lib/public-token";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { calculateEstimatedWait } from "@/lib/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Clinic } from "@/lib/types";

type RouteContext = {
  params: Promise<{ tokenId: string }>;
};

export const GET = withSentryApiRoute(
  "GET",
  "/api/queue/[tokenId]",
  async function GET(_request: Request, context: RouteContext) {
    const { tokenId } = await context.params;
    const supabase = createAdminClient();

    const { data: entry, error: entryError } = await supabase
      .from("tokens")
      .select(PUBLIC_TOKEN_SELECT)
      .eq("id", tokenId)
      .single();

    if (entryError || !entry) {
      return NextResponse.json({ error: "Token not found." }, { status: 404 });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select(PUBLIC_CLINIC_SELECT)
      .eq("id", entry.clinic_id)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    }

    const { data: waiting } = await supabase
      .from("tokens")
      .select("id, queue_position")
      .eq("clinic_id", entry.clinic_id)
      .eq("status", "waiting")
      .order("queue_position", { ascending: true });

    const positionInQueue =
      waiting?.findIndex((item) => item.id === entry.id) ?? -1;

    const estimatedWaitMinutes = calculateEstimatedWait(
      Math.max(0, positionInQueue),
      clinic.avg_time_per_patient,
    );

    return NextResponse.json({
      entry: toPublicToken(entry),
      clinic: toPublicClinic(clinic as Clinic),
      currentToken: clinic.current_token,
      positionInQueue: Math.max(0, positionInQueue),
      estimatedWaitMinutes,
    });
  },
);
