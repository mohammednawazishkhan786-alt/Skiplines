import { NextResponse } from "next/server";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { getPublicAppUrl, getWhatsAppVerifyToken } from "@/lib/env";
import { getAIReceptionistReply } from "@/lib/openai";
import { createQueueEntry } from "@/lib/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Clinic } from "@/lib/types";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook";
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
      const rawBody = await request.text();
      const signature = request.headers.get("x-hub-signature-256");

      if (!verifyWhatsAppWebhookSignature(signature, rawBody)) {
        return NextResponse.json(
          { error: "Invalid webhook signature." },
          { status: 401 },
        );
      }

      const body = JSON.parse(rawBody) as {
        object?: string;
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{
                type?: string;
                from?: string;
                text?: { body?: string };
              }>;
            };
          }>;
        }>;
      };

      if (body.object !== "whatsapp_business_account") {
        return NextResponse.json({ status: "ignored" });
      }

      const supabase = createAdminClient();
      const appUrl = getPublicAppUrl();

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
              const queueEntry = await createQueueEntry(
                supabase,
                clinic as Clinic,
                { patientPhone },
              );

              const reply = `✅ Token #${queueEntry.token_number} issued for ${clinic.clinic_name}. Track your wait live: ${appUrl}/live/${queueEntry.id}`;

              await sendWhatsAppMessage(patientPhone, reply);
              await logNotification(
                clinicId,
                queueEntry.id,
                patientPhone,
                "token_issued",
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
