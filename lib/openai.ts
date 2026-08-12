import OpenAI from "openai";
import { getOpenAIApiKey } from "@/lib/env";
import type { Clinic } from "@/lib/types";

function getOpenAIClient() {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

type ReceptionistInput = {
  clinic: Clinic;
  userMessage: string;
  patientPhone: string;
};

export async function getAIReceptionistReply({
  clinic,
  userMessage,
  patientPhone,
}: ReceptionistInput): Promise<string> {
  const fallback = `Welcome to ${clinic.clinic_name}! Reply TOKEN to get your queue number. Fees: ₹${clinic.consultation_fee}. Hours: ${clinic.clinic_hours}.`;

  const openai = getOpenAIClient();
  if (!openai) {
    return fallback;
  }

  const systemPrompt = `You are the 24/7 AI receptionist for ${clinic.clinic_name}, run by Dr. ${clinic.doctor_name}.
Answer patient questions concisely and warmly.
Clinic consultation fee: ₹${clinic.consultation_fee}
Clinic hours: ${clinic.clinic_hours}
Average wait per patient: ${clinic.avg_time_per_patient} minutes.
To get a queue token, patients should send: TOKEN
If asked about location or directions, say to contact the clinic at ${clinic.phone}.
Keep replies under 3 sentences. Use Indian English.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Patient phone: ${patientPhone}\nMessage: ${userMessage}` },
    ],
    max_tokens: 200,
    temperature: 0.4,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ??
    `Thank you for contacting ${clinic.clinic_name}. Reply TOKEN to join the queue.`
  );
}
