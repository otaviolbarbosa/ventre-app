import { mustHaveActiveSubscription } from "@/lib/access-control";
import type { UserProfile } from "@/lib/server-auth";
import { isSubscriptionActive } from "@/lib/subscription";
import type { Tables } from "@ventre/supabase/types";

type Subscription = Pick<Tables<"subscriptions">, "status" | "expires_at"> | null;

/**
 * Whether the currently-logged-in profile should be redirected to the
 * paywall instead of rendering the dashboard.
 */
export function shouldRedirectToPaywall({
  profile,
  subscription,
  bypassFlagEnabled,
}: {
  profile: UserProfile | null;
  subscription: Subscription;
  bypassFlagEnabled: boolean;
}): boolean {
  if (!mustHaveActiveSubscription(profile)) return false;
  if (bypassFlagEnabled) return false;
  return !isSubscriptionActive(subscription);
}
