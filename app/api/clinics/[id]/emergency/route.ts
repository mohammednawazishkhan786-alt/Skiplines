import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { promoteEmergencyToken } from "@/lib/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let entryId: string | undefined;
  try {
    const body = await request.json();
    entryId = body.entry_id;
  } catch {
    return NextResponse.json({ error: "entry_id is required." }, { status: 400 });
  }

  if (!entryId) {
    return NextResponse.json({ error: "entry_id is required." }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const entry = await promoteEmergencyToken(supabase, id, entryId);
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Emergency failed." },
      { status: 400 },
    );
  }
}
