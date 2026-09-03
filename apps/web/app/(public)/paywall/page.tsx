import PaywallScreen from "@/screens/paywall-screen";
import type { Tables } from "@ventre/supabase";
import { createServerSupabaseClient } from "@ventre/supabase/server";

export default async function PaywallPage() {
  const supabase = await createServerSupabaseClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, name, slug, value, description, benefits")
    .eq("is_active", true)
    .eq("type", "premium")
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  let monthPrice = plan?.value ?? null;
  let yearPrice: number | null = null;

  if (plan) {
    const [{ data: monthLink, error: monthLinkError }, { data: yearLink, error: yearLinkError }] =
      await Promise.all([
        // biome-ignore lint/suspicious/noExplicitAny: get_active_payment_link RPC not yet in generated types — run pnpm db:types to fix
        (supabase.rpc as any)("get_active_payment_link", {
          p_plan_id: plan.id,
          p_frequence: "month",
        }),
        // biome-ignore lint/suspicious/noExplicitAny: get_active_payment_link RPC not yet in generated types — run pnpm db:types to fix
        (supabase.rpc as any)("get_active_payment_link", {
          p_plan_id: plan.id,
          p_frequence: "year",
        }),
      ]);

    if (monthLinkError) throw new Error(monthLinkError.message);
    if (yearLinkError) throw new Error(yearLinkError.message);

    if (monthLink?.amount != null) monthPrice = monthLink.amount;
    if (yearLink?.amount != null) yearPrice = yearLink.amount;
  }

  return (
    <PaywallScreen plan={plan as Tables<"plans">} monthPrice={monthPrice} yearPrice={yearPrice} />
  );
}
