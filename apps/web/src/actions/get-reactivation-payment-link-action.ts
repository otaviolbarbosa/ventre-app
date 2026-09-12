"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { buildPaymentLinkRedirectUrl } from "@/lib/stripe-payment-link-redirect";
import { z } from "zod";

const schema = z.object({
  subscriptionId: z.string().uuid("ID da assinatura inválido"),
});

/**
 * Resolves the payment link for a user's own (possibly inactive) subscription,
 * so they can regularize the exact plan/frequence they were on — bypassing the
 * plans.is_active gate in createStripeCheckoutSessionAction, which exists to
 * stop new customers from buying a discontinued plan, not to block renewals.
 */
export const getReactivationPaymentLinkAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user, profile } }) => {
    const orFilter = profile.enterprise_id
      ? `user_id.eq.${profile.id},enterprise_id.eq.${profile.enterprise_id}`
      : `user_id.eq.${profile.id}`;

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, plan_id, frequence")
      .eq("id", parsedInput.subscriptionId)
      .or(orFilter)
      .single();

    if (error || !subscription) {
      throw new Error("Assinatura não encontrada.");
    }

    // biome-ignore lint/suspicious/noExplicitAny: get_active_payment_link rpc not yet in generated types — run pnpm db:types to fix
    const { data: paymentLink, error: paymentLinkError } = await (supabase as any).rpc(
      "get_active_payment_link",
      {
        p_plan_id: subscription.plan_id,
        p_frequence: subscription.frequence,
      },
    );

    if (paymentLinkError) {
      throw new Error("Erro ao buscar link de pagamento");
    }

    const activeLink = (paymentLink as { payment_link_url: string } | null | undefined) ?? null;

    if (!activeLink) {
      return { url: null };
    }

    if (!user.email) {
      throw new Error("E-mail do usuário não encontrado");
    }

    const redirectUrl = buildPaymentLinkRedirectUrl({
      paymentLinkUrl: activeLink.payment_link_url,
      userId: user.id,
      email: user.email,
    });

    await captureServerEvent(user.id, "reactivate_subscription_payment_link", {
      subscription_id: subscription.id,
      plan_id: subscription.plan_id,
    });

    return { url: redirectUrl };
  });
