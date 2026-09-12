import type { Tables } from "@ventre/supabase/types";

type SubscriptionStatus = Tables<"subscriptions">["status"];

const STATUS_MESSAGES: Partial<Record<SubscriptionStatus, string>> = {
  canceled: "Sua assinatura foi cancelada.",
  expired: "Sua assinatura expirou.",
  failed: "Não conseguimos confirmar o pagamento da sua assinatura.",
  canceling: "O período da sua assinatura chegou ao fim.",
  pending: "Sua assinatura ainda não foi confirmada.",
  replaced: "Sua assinatura anterior não está mais ativa.",
};

export function getSubscriptionRenewalMessage(status: SubscriptionStatus): string {
  return STATUS_MESSAGES[status] ?? "Sua assinatura não está mais ativa.";
}
