import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function getActiveEnterpriseBillingFees(
  supabaseAdmin: SupabaseAdminClient,
  enterpriseId: string,
): Promise<Tables<"enterprise_billing_fees">[]> {
  const { data, error } = await supabaseAdmin
    .from("enterprise_billing_fees")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .eq("is_active", true);

  if (error) {
    console.error("[getActiveEnterpriseBillingFees]", error.message);
    return [];
  }

  return data;
}

export async function getEnterpriseBillingFees(): Promise<Tables<"enterprise_billing_fees">[]> {
  const { profile } = await getServerAuth();
  if (!profile?.enterprise_id) return [];

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("enterprise_billing_fees")
    .select("*")
    .eq("enterprise_id", profile.enterprise_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEnterpriseBillingFees]", error.message);
    return [];
  }

  return data;
}
