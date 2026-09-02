type SubscriptionFrequence = "month" | "quarter" | "semester" | "year";

type ResolvedCheckoutSource = {
  userId: string | null;
  enterpriseId: string | null;
  planId: string;
  frequence: SubscriptionFrequence;
};

export function resolveCheckoutSource({
  metadata,
  clientReferenceId,
  paymentLinkPlan,
}: {
  metadata: { user_id?: string; enterprise_id?: string; plan_id?: string; frequence?: string };
  clientReferenceId: string | null;
  paymentLinkPlan: { planId: string; frequence: string } | null;
}): ResolvedCheckoutSource | null {
  const planId = paymentLinkPlan?.planId ?? metadata.plan_id;
  const frequence = paymentLinkPlan?.frequence ?? metadata.frequence;

  if (!planId || !frequence) return null;

  const userId = metadata.user_id ?? clientReferenceId ?? null;
  const enterpriseId = metadata.enterprise_id ?? null;

  return {
    userId,
    enterpriseId,
    planId,
    frequence: frequence as SubscriptionFrequence,
  };
}

/**
 * Detects a client_reference_id spoofing attempt: the payment-link checkout path trusts a
 * plain, client-editable URL query parameter as the userId, so a user could pay with their
 * own card but attribute the subscription to someone else's account. Compares the resolved
 * user's stored email against the email Stripe recorded for the person who actually paid.
 * Returns false (no mismatch) whenever either email is unavailable — this is a mitigation for
 * the common case, not a hard block when data is missing.
 */
export function isSpoofedCheckoutEmail({
  resolvedUserEmail,
  payingCustomerEmail,
}: {
  resolvedUserEmail?: string | null;
  payingCustomerEmail?: string | null;
}): boolean {
  if (!resolvedUserEmail || !payingCustomerEmail) return false;
  return resolvedUserEmail.toLowerCase() !== payingCustomerEmail.toLowerCase();
}
