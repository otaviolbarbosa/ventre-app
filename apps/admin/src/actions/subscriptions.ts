"use server";

import { adminActionClient } from "@/lib/safe-action";
import type { SubscriptionRow } from "@/types";
import { revalidatePath } from "next/cache";
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
