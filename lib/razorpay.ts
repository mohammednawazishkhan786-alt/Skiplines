import Razorpay from "razorpay";

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createMonthlySubscription(clinicId: string, email: string) {
  const razorpay = getRazorpayClient();
  const planId = process.env.RAZORPAY_PLAN_ID;

  if (!planId) {
    throw new Error("RAZORPAY_PLAN_ID is not configured.");
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 12,
    customer_notify: 1,
    notes: { clinic_id: clinicId },
    notify_info: { notify_email: email },
    start_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  });

  return subscription;
}
