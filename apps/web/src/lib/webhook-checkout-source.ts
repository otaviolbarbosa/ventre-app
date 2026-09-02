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
