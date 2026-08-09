import { NextResponse } from "next/server";
import { notifyWaitingPatientsOfShift, shiftTokenLate } from "@/lib/queue";
import { createClient } from "@/lib/supabase/server";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{ tokenId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { tokenId } = await context.params;
  const supabase = await createClient();

  try {
    const entry = await shiftTokenLate(supabase, tokenId);
    await notifyWaitingPatientsOfShift(supabase, entry.clinic_id, entry.id);

    if (entry.patient_phone) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const message = `✅ Your token #${entry.token_number} has been shifted back 2 slots. New estimated wait updated. Track live: ${appUrl}/live/${entry.id}`;
      await sendWhatsAppMessage(entry.patient_phone, message);
      await logNotification(
        entry.clinic_id,
        entry.id,
        entry.patient_phone,
        "late_shift",
        message,
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Late shift failed." },
      { status: 400 },
    );
  }
}
