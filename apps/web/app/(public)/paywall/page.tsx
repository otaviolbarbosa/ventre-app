import { getLatestSubscription } from "@/lib/queries/subscriptions";
import { getServerAuth } from "@/lib/server-auth";
import { isSubscriptionActive } from "@/lib/subscription";
import PaywallScreen, { type RenewalInfo } from "@/screens/paywall-screen";
import type { Tables } from "@ventre/supabase";
import { createServerSupabaseClient } from "@ventre/supabase/server";

export default async function PaywallPage() {
  const supabase = await createServerSupabaseClient();
  const { profile } = await getServerAuth();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, name, slug, value, description, benefits")
    .eq("is_active", true)
    .eq("type", "premium")
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  let monthPrice = plan?.value ?? null;
  let yearPrice: number | null = null;
  let monthTrialDays = 0;
  let yearTrialDays = 0;

  if (plan) {
    const [{ data: monthLink, error: monthLinkError }, { data: yearLink, error: yearLinkError }] =
      await Promise.all([
        supabase.rpc("get_active_payment_link", {
          p_plan_id: plan.id,
          p_frequence: "month",
        }),
        supabase.rpc("get_active_payment_link", {
          p_plan_id: plan.id,
          p_frequence: "year",
        }),
      ]);

    if (monthLinkError) throw new Error(monthLinkError.message);
    if (yearLinkError) throw new Error(yearLinkError.message);

    if (monthLink?.amount != null) monthPrice = monthLink.amount;
    if (yearLink?.amount != null) yearPrice = yearLink.amount;
    monthTrialDays = monthLink?.days_off ?? 0;
    yearTrialDays = yearLink?.days_off ?? 0;
  }

  let renewal: RenewalInfo | null = null;

  if (profile) {
    const latestSubscription = await getLatestSubscription(supabase, profile);
    if (latestSubscription && !isSubscriptionActive(latestSubscription)) {
      renewal = {
        subscriptionId: latestSubscription.id,
        status: latestSubscription.status,
        expiresAt: latestSubscription.expires_at,
      };
    }
  }

  return (
    <PaywallScreen
      plan={plan as Tables<"plans">}
      monthPrice={monthPrice}
      yearPrice={yearPrice}
      monthTrialDays={monthTrialDays}
      yearTrialDays={yearTrialDays}
      userType={profile?.user_type ?? null}
      renewal={renewal}
    />
  );
}
