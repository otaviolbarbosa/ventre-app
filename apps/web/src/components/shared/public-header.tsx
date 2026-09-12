import { PublicHeaderClient } from "@/components/shared/public-header-client";
import { getLatestSubscription } from "@/lib/queries/subscriptions";
import { getServerAuth } from "@/lib/server-auth";
import { isSubscriptionActive } from "@/lib/subscription";

export async function PublicHeader() {
  const { supabase, user, profile } = await getServerAuth();

  const subscription = profile
    ? await getLatestSubscription(supabase, profile)
    : null;

  return (
    <PublicHeaderClient
      userId={user?.id}
      hasActiveSubscription={isSubscriptionActive(subscription)}
    />
  );
}
