import type { UserProfile } from "@/lib/server-auth";
import type { createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type LatestSubscription = Tables<"subscriptions"> & { plans: Tables<"plans"> | null };

/**
 * Most recent subscription for this profile — owned either directly
 * (user_id) or through their enterprise (enterprise_id, for staff).
 */
export async function getLatestSubscription(
  supabase: SupabaseClient,
  profile: Pick<UserProfile, "id" | "enterprise_id">,
): Promise<LatestSubscription | null> {
  const orFilter = profile.enterprise_id
    ? `user_id.eq.${profile.id},enterprise_id.eq.${profile.enterprise_id}`
    : `user_id.eq.${profile.id}`;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}
