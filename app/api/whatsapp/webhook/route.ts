import { NextResponse } from "next/server";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { getWhatsAppVerifyToken } from "@/lib/env";
import { getAIReceptionistReply } from "@/lib/openai";
import { createQueueEntry } from "@/lib/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Clinic } from "@/lib/types";
import { logNotification, sendWhatsAppMessage } from "@/lib/whatsapp";

export const GET = withSentryApiRoute(
  "GET",
  "/api/whatsapp/webhook",
  async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === getWhatsAppVerifyToken()) {
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  },
);

export const POST = withSentryApiRoute(
  "POST",
  "/api/whatsapp/webhook",
  async function POST(request: Request) {
    try {
      const body = await request.json();

      if (body.object !== "whatsapp_business_account") {
        return NextResponse.json({ status: "ignored" });
      }

      const supabase = createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const messages = change.value?.messages ?? [];

          for (const message of messages) {
            if (message.type !== "text" || !message.text?.body) continue;

            const patientPhone = message.from as string;
            const text = message.text.body.trim();
            const upper = text.toUpperCase();

            const clinicIdMatch = text.match(
              /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
            );
            const clinicId = clinicIdMatch?.[0];

            if (!clinicId) {
              await sendWhatsAppMessage(
                patientPhone,
                "Welcome to Skiplines! Please scan the clinic QR code to get started, or send: TOKEN <clinic-id>",
              );
              continue;
            }

            const { data: clinic } = await supabase
              .from("clinics")
              .select("*")
              .eq("id", clinicId)
              .single();

            if (!clinic) {
              await sendWhatsAppMessage(
                patientPhone,
                "Clinic not found. Please scan the QR code at the clinic reception.",
              );
              continue;
            }

            if (upper.startsWith("TOKEN") || upper.startsWith("JOIN")) {
              const isEmergency = upper.includes("EMERGENCY");
              const queueEntry = await createQueueEntry(
                supabase,
                clinic as Clinic,
                { patientPhone, isEmergency },
              );

              const reply = isEmergency
                ? `🚨 Emergency token #${queueEntry.token_number} issued. You are prioritized. Track live: ${appUrl}/live/${queueEntry.id}`
                : `✅ Token #${queueEntry.token_number} issued for ${clinic.clinic_name}. Track your wait live: ${appUrl}/live/${queueEntry.id}`;

              await sendWhatsAppMessage(patientPhone, reply);
              await logNotification(
                clinicId,
                queueEntry.id,
                patientPhone,
                isEmergency ? "emergency_token" : "token_issued",
                reply,
              );
              continue;
            }

            if (upper.includes("EMERGENCY")) {
              const queueEntry = await createQueueEntry(
                supabase,
                clinic as Clinic,
                { patientPhone, isEmergency: true },
              );

              const reply = `🚨 Emergency token #${queueEntry.token_number} issued. Track live: ${appUrl}/live/${queueEntry.id}`;
              await sendWhatsAppMessage(patientPhone, reply);
              await logNotification(
                clinicId,
                queueEntry.id,
                patientPhone,
                "emergency_token",
                reply,
              );
              continue;
            }

            const aiReply = await getAIReceptionistReply({
              clinic: clinic as Clinic,
              userMessage: text,
              patientPhone,
            });

            const fullReply = `${aiReply}\n\nReply TOKEN to get your queue number.`;
            await sendWhatsAppMessage(patientPhone, fullReply);
            await logNotification(
              clinicId,
              null,
              patientPhone,
              "ai_receptionist",
              fullReply,
            );
          }
        }
      }

      return NextResponse.json({ status: "ok" });
    } catch (error) {
      captureApiError(error);
      console.error("WhatsApp webhook error:", error);
      return NextResponse.json({ status: "error" }, { status: 500 });
    }
  },
);
