"use server";

import { adminActionClient } from "@/lib/safe-action";
import type { Tables } from "@ventre/supabase/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const getPaginatedSchema = z.object({
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).default(10),
});

export const getPaginatedPlansAction = adminActionClient
  .schema(getPaginatedSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: rpc not yet in generated types — run pnpm db:types to fix
    const { data, error } = await (ctx.supabaseAdmin as any).rpc("get_paginated_plans", {
      page: parsedInput.page,
      size: parsedInput.size,
    });

    if (error) throw new Error(error.message);

    return data as {
      data: Tables<"plans">[];
      pagination: { page: number; size: number; total_pages: number };
    };
  });

const planSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  slug: z.string().min(2, "Slug deve ter ao menos 2 caracteres"),
  description: z.string().nullable().optional(),
  type: z.enum(["free", "premium", "enterprise"]),
  value: z.number().min(0).nullable().optional(),
  benefits: z.array(z.string()).optional(),
});

const updatePlanSchema = planSchema.extend({
  id: z.string().uuid(),
});

const deletePlanSchema = z.object({
  id: z.string().uuid(),
});

export const createPlanAction = adminActionClient
  .schema(planSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("plans").insert({
      ...parsedInput,
      benefits: parsedInput.benefits ?? [],
    });

    if (error) throw new Error(error.message);

    revalidatePath("/plans");
    return { success: true };
  });

export const updatePlanAction = adminActionClient
  .schema(updatePlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("plans").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/plans");
    revalidatePath(`/plans/${id}`);
    return { success: true };
  });

export const deletePlanAction = adminActionClient
  .schema(deletePlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("plans").delete().eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/plans");
    return { success: true };
  });
