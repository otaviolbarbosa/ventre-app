"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";
import Stripe from "stripe";

const schema = z.object({
  subscriptionId: z.string().uuid("ID da assinatura inválido"),
});

export const cancelSubscriptionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, profile } }) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe não configurado.");
    }

    // Apenas assinaturas individuais (não empresariais)
    if (profile.enterprise_id) {
      throw new Error("Cancelamento de assinaturas empresariais deve ser feito pelo gestor.");
    }

    // Busca a assinatura no banco, garantindo que pertence ao usuário
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, subscription_id, status")
      .eq("id", parsedInput.subscriptionId)
      .eq("user_id", profile.id)
      .single();

    if (error || !subscription) {
      throw new Error("Assinatura não encontrada.");
    }

    if (subscription.status !== "active") {
      throw new Error("Somente assinaturas ativas podem ser canceladas.");
    }

    // Solicita cancelamento ao final do período no Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.subscriptions.update(subscription.subscription_id, {
      cancel_at_period_end: true,
    });

    // Atualiza o banco imediatamente para feedback no UI
    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceling", updated_at: new Date().toISOString() })
      .eq("id", subscription.id);

    if (updateError) {
      throw new Error("Erro ao atualizar status da assinatura.");
    }

    return { success: true };
  });
