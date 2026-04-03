"use server";

import { adminActionClient } from "@/lib/safe-action";
import type { Tables } from "@ventre/supabase/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const getPaginatedSchema = z.object({
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).default(10),
});

export const getPaginatedEnterprisesAction = adminActionClient
  .schema(getPaginatedSchema)
  .action(async ({ parsedInput, ctx }) => {
    // biome-ignore lint/suspicious/noExplicitAny: rpc not yet in generated types — run pnpm db:types to fix
    const { data, error } = await (ctx.supabaseAdmin as any).rpc("get_paginated_enterprises", {
      page: parsedInput.page,
      size: parsedInput.size,
    });

    if (error) throw new Error(error.message);

    return data as {
      data: Tables<"enterprises">[];
      pagination: { page: number; size: number; total_pages: number };
    };
  });

const enterpriseSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  legal_name: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional(),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  professionals_amount: z.number().int().min(1).optional(),
  slug: z.string().min(2, "Slug deve ter ao menos 2 caracteres"),
});

const updateEnterpriseSchema = enterpriseSchema.extend({
  id: z.string().uuid(),
});

const deleteEnterpriseSchema = z.object({
  id: z.string().uuid(),
});

export const createEnterpriseAction = adminActionClient
  .schema(enterpriseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const token = crypto.randomUUID();

    const { error } = await ctx.supabaseAdmin.from("enterprises").insert({
      ...parsedInput,
      token,
      professionals_amount: parsedInput.professionals_amount ?? 1,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/enterprises");
    return { success: true };
  });

export const updateEnterpriseAction = adminActionClient
  .schema(updateEnterpriseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("enterprises").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/enterprises");
    revalidatePath(`/enterprises/${id}`);
    return { success: true };
  });

export const deleteEnterpriseAction = adminActionClient
  .schema(deleteEnterpriseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("enterprises").delete().eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/enterprises");
    return { success: true };
  });
