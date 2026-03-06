"use server";

import { dayjs } from "@/lib/dayjs";
import { authActionClient } from "@/lib/safe-action";
import Stripe from "stripe";
import { z } from "zod";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const schema = z.object({
  slug: z.string().min(1, "Escolha um plano para fazer assinatura"),
});

export const createStripeCheckoutSessionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Erro ao inicializar gateway de pagamento");
    }

    const { data: plan, error } = await supabase
      .from("plans")
      .select()
      .eq("slug", parsedInput.slug)
      .single();

    if (!plan || error) {
      throw new Error("Plano de assinatura não encontrado");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });

    if (!stripe) {
      throw new Error("Erro ao inicializar o gateway de pagamento");
    }

    if (plan.value === null) {
      throw new Error("Plano de assinatura inválido para pagamento");
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: user.email,
      payment_method_types: ["card", "boleto"],
      mode: "subscription",
      success_url: `${APP_URL}/payment-confirmation`,
      cancel_url: `${APP_URL}/paywall`,
      locale: "pt-BR",
      metadata: {
        date: dayjs().toISOString(),
        plan_id: plan.id,
        frequence: "month",
        user_id: user.id,
      },
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: plan.value,
            product_data: {
              name: plan.name,
              ...(plan.description ? { description: plan.description } : {}),
            },
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return checkoutSession.url;
  });
