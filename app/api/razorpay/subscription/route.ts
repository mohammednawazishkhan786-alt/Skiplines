import { NextResponse } from "next/server";
import { createMonthlySubscription } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clinicId = body.clinic_id as string;

    if (!clinicId) {
      return NextResponse.json(
        { error: "clinic_id is required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("id, email, subscription_status, razorpay_subscription_id")
      .eq("id", clinicId)
      .single();

    if (error || !clinic) {
      return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    }

    if (clinic.razorpay_subscription_id) {
      return NextResponse.json({
        subscription_id: clinic.razorpay_subscription_id,
        status: clinic.subscription_status,
        message: "Subscription already exists.",
      });
    }

    const subscription = await createMonthlySubscription(clinic.id, clinic.email);

    await supabase
      .from("clinics")
      .update({
        razorpay_subscription_id: subscription.id,
        subscription_status: subscription.status,
      })
      .eq("id", clinicId);

    return NextResponse.json({
      subscription_id: subscription.id,
      status: subscription.status,
      plan: "₹999/month",
      trial_days: 7,
      short_url: subscription.short_url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Subscription creation failed.",
      },
      { status: 500 },
    );
  }
}
