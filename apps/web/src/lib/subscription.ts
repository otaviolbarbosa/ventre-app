import type { Tables } from "@ventre/supabase/types";

type SubscriptionAccessFields = Pick<Tables<"subscriptions">, "status" | "expires_at">;

/**
 * Mirrors the rule documented on subscriptions.expires_at: premium access is
 * active while now() < expires_at AND status IN ('active', 'canceling').
 * 'canceled' (immediate, e.g. refund) always loses access regardless of expires_at.
 */
export function isSubscriptionActive(
  subscription: SubscriptionAccessFields | null | undefined,
): boolean {
  if (!subscription) return false;
  if (subscription.status !== "active" && subscription.status !== "canceling") return false;
  if (!subscription.expires_at) return false;
  return new Date(subscription.expires_at) > new Date();
}
