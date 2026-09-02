"use server";

import { dayjs } from "@/lib/dayjs";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { buildPaymentLinkRedirectUrl } from "@/lib/stripe-payment-link-redirect";
import Stripe from "stripe";
import { z } from "zod";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const schema = z.object({
  slug: z.string().min(1, "Escolha um plano para fazer assinatura"),
  frequence: z.enum(["month", "year"]),
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
      // biome-ignore lint/suspicious/noExplicitAny: plans.is_active not yet in generated types — run pnpm db:types to fix
      .eq("is_active" as any, true)
      .single();

    if (!plan || error) {
      throw new Error("Plano de assinatura não encontrado");
    }

    // biome-ignore lint/suspicious/noExplicitAny: get_active_payment_link rpc not yet in generated types — run pnpm db:types to fix
    const { data: paymentLink, error: paymentLinkError } = await (supabase as any).rpc(
      "get_active_payment_link",
      {
        p_plan_id: plan.id,
        p_frequence: parsedInput.frequence,
      },
    );

    if (paymentLinkError) {
      throw new Error("Erro ao buscar link de pagamento");
    }

    const activeLink =
      (paymentLink as { payment_link_url: string } | null | undefined) ?? null;

    if (activeLink) {
      if (!user.email) {
        throw new Error("E-mail do usuário não encontrado");
      }

      const redirectUrl = buildPaymentLinkRedirectUrl({
        paymentLinkUrl: activeLink.payment_link_url,
        userId: user.id,
        email: user.email,
      });

      await captureServerEvent(user.id, "create_stripe_checkout_session", {
        plan_id: plan.id,
        source: "payment_link",
      });

      return redirectUrl;
    }

    if (plan.value === null) {
      throw new Error("Plano de assinatura inválido para pagamento");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });

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
        frequence: parsedInput.frequence,
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
              interval: parsedInput.frequence === "year" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    await captureServerEvent(user.id, "create_stripe_checkout_session", {
      plan_id: plan.id,
      source: "dynamic_fallback",
    });

    return checkoutSession.url;
  });
