import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/auth/cron";
import { reconcileClinics } from "@/lib/reconcile-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSentryApiRoute } from "@/lib/sentry-api";

export const dynamic = "force-dynamic";

async function handleReconcileSubscriptions(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: clinics, error } = await supabase
    .from("clinics")
    .select(
      "id, subscription_status, trial_ends_at, subscription_expires_at",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = reconcileClinics(clinics ?? []);

  for (const action of summary.actions) {
    if (action.type === "expire_trial") {
      await supabase
        .from("clinics")
        .update({
          subscription_status: "expired",
          expired_at: now,
          updated_at: now,
        })
        .eq("id", action.clinicId);
    }

    if (action.type === "expire_subscription") {
      await supabase
        .from("clinics")
        .update({
          subscription_status: "expired",
          expired_at: now,
          updated_at: now,
        })
        .eq("id", action.clinicId);
    }
  }

  return NextResponse.json({
    expired_trials: summary.expiredTrials,
    expired_subscriptions: summary.expiredSubscriptions,
    checked: summary.checked,
  });
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/jobs/reconcile-subscriptions",
  handleReconcileSubscriptions,
);

export const GET = withSentryApiRoute(
  "GET",
  "/api/jobs/reconcile-subscriptions",
  handleReconcileSubscriptions,
);
