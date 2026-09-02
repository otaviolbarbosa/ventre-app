import { createServerSupabaseClient } from "@ventre/supabase/server";
import PaywallScreen from "@/screens/paywall-screen";

const PREMIUM_PLAN_SLUG = "plus-care";

export default async function PaywallPage() {
  const supabase = await createServerSupabaseClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, value")
    // biome-ignore lint/suspicious/noExplicitAny: is_active column not yet in generated types — run pnpm db:types to fix
    .eq("is_active" as any, true)
    .eq("slug", PREMIUM_PLAN_SLUG)
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  let monthPrice = plan?.value ?? null;
  let yearPrice: number | null = null;

  if (plan) {
    const [
      { data: monthLink, error: monthLinkError },
      { data: yearLink, error: yearLinkError },
    ] = await Promise.all([
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

  return <PaywallScreen monthPrice={monthPrice} yearPrice={yearPrice} />;
}
