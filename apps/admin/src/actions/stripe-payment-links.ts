"use server";

import { adminActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const frequenceEnum = z.enum(["month", "quarter", "semester", "year"]);

const basePaymentLinkSchema = z.object({
  plan_id: z.string().uuid(),
  frequence: frequenceEnum,
  payment_link_url: z.string().url("Informe uma URL válida"),
  stripe_payment_link_id: z.string().min(1, "Informe o ID do payment link no Stripe"),
  is_active: z.boolean().default(true),
  is_primary: z.boolean().default(false),
  is_priority: z.boolean().default(false),
  is_limited: z.boolean().default(false),
  total_subscriptions: z.number().int().min(1).nullable().optional(),
  amount: z.number().int().min(0).nullable().optional(),
});

const paymentLinkSchema = basePaymentLinkSchema
  .refine((data) => !data.is_limited || data.total_subscriptions != null, {
    message: "Informe o total de assinaturas quando o link tiver uso limitado",
    path: ["total_subscriptions"],
  })
  .refine((data) => data.frequence !== "year" || data.amount != null, {
    message: "Informe o valor (amount) para links de frequência anual",
    path: ["amount"],
  });

const updatePaymentLinkSchema = basePaymentLinkSchema
  .extend({ id: z.string().uuid() })
  .refine((data) => !data.is_limited || data.total_subscriptions != null, {
    message: "Informe o total de assinaturas quando o link tiver uso limitado",
    path: ["total_subscriptions"],
  })
  .refine((data) => data.frequence !== "year" || data.amount != null, {
    message: "Informe o valor (amount) para links de frequência anual",
    path: ["amount"],
  });

const byPlanSchema = z.object({ plan_id: z.string().uuid() });
const byIdSchema = z.object({ id: z.string().uuid() });

export const getPaymentLinksByPlanAction = adminActionClient
  .schema(byPlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
    const { data, error } = await (ctx.supabaseAdmin as any)
      .from("stripe_payment_link")
      .select()
      .eq("plan_id", parsedInput.plan_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  });

export const createPaymentLinkAction = adminActionClient
  .schema(paymentLinkSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
    const { error } = await (ctx.supabaseAdmin as any)
      .from("stripe_payment_link")
      .insert(parsedInput);

    if (error) throw new Error(error.message);

    revalidatePath(`/plans/${parsedInput.plan_id}`);
    return { success: true };
  });

export const updatePaymentLinkAction = adminActionClient
  .schema(updatePaymentLinkSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
    const { error } = await (ctx.supabaseAdmin as any)
      .from("stripe_payment_link")
      .update(data)
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath(`/plans/${parsedInput.plan_id}`);
    return { success: true };
  });

export const deletePaymentLinkAction = adminActionClient
  .schema(byIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
    const { error } = await (ctx.supabaseAdmin as any)
      .from("stripe_payment_link")
      .delete()
      .eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/plans");
    return { success: true };
  });
