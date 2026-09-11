"use server";

import { adminActionClient } from "@/lib/safe-action";
import type { SubscriptionRow } from "@/types";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";

const getPaginatedSchema = z.object({
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).default(10),
});

export const getPaginatedSubscriptionsAction = adminActionClient
  .schema(getPaginatedSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: rpc not yet in generated types — run pnpm db:types to fix
    const { data, error } = await (ctx.supabaseAdmin as any).rpc("get_paginated_subscriptions", {
      page: parsedInput.page,
      size: parsedInput.size,
    });

    if (error) throw new Error(error.message);

    return data as {
      data: SubscriptionRow[];
      pagination: { page: number; size: number; total_pages: number };
    };
  });

const updateSubscriptionSchema = z.object({
  id: z.string().uuid(),
  status: z
    .enum(["active", "pending", "canceling", "canceled", "expired", "failed", "replaced"])
    .optional(),
  expires_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  cancelation_reason: z.string().nullable().optional(),
});

const deleteSubscriptionSchema = z.object({
  id: z.string().uuid(),
});

export const updateSubscriptionAction = adminActionClient
  .schema(updateSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("subscriptions").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${id}`);
    return { success: true };
  });

export const deleteSubscriptionAction = adminActionClient
  .schema(deleteSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/subscriptions");
    return { success: true };
  });

const cancelSubscriptionSchema = z.object({
  id: z.string().uuid(),
  cancelation_reason: z.string().nullable().optional(),
  refund_last_payment: z.boolean().default(false),
});

export const cancelSubscriptionAction = adminActionClient
  .schema(cancelSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe não configurado.");
    }

    const { data: subscription, error } = await ctx.supabaseAdmin
      .from("subscriptions")
      .select("id, subscription_id")
      .eq("id", parsedInput.id)
      .single();

    if (error || !subscription) {
      throw new Error("Assinatura não encontrada.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });

    // A refund implies the professional loses access right away, so cancel immediately instead
    // of at the end of the current period.
    if (parsedInput.refund_last_payment) {
      const stripeSubscription = await stripe.subscriptions.cancel(subscription.subscription_id, {
        expand: ["latest_invoice.payments"],
      });

      const latestInvoice = stripeSubscription.latest_invoice;
      const lastPayment =
        typeof latestInvoice === "object" ? latestInvoice?.payments?.data[0]?.payment : null;

      const paymentIntent = lastPayment?.payment_intent;
      const paymentIntentId =
        typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null);

      const charge = lastPayment?.charge;
      const chargeId = typeof charge === "string" ? charge : (charge?.id ?? null);

      if (!paymentIntentId && !chargeId) {
        throw new Error("Não foi possível localizar o pagamento para reembolso.");
      }

      await stripe.refunds.create(
        paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId as string },
      );
    } else {
      await stripe.subscriptions.update(subscription.subscription_id, {
        cancel_at_period_end: true,
      });
    }

    const { error: updateError } = await ctx.supabaseAdmin
      .from("subscriptions")
      .update({
        status: parsedInput.refund_last_payment ? "canceled" : "canceling",
        cancelation_reason: parsedInput.cancelation_reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) throw new Error("Erro ao atualizar status da assinatura.");

    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${subscription.id}`);
    return { success: true };
  });
