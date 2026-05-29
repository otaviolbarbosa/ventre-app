"use server";

import { adminActionClient } from "@/lib/safe-action";
import type { UserWithEnterprise } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  user_type: z.enum(["professional", "patient", "manager", "secretary", "admin"]),
  professional_type: z.enum(["obstetra", "enfermeiro", "doula"]).nullable().optional(),
  enterprise_id: z.string().uuid().nullable().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  user_type: z.enum(["professional", "patient", "manager", "secretary", "admin"]),
  professional_type: z.enum(["obstetra", "enfermeiro", "doula"]).nullable().optional(),
  enterprise_id: z.string().uuid().nullable().optional(),
});


const deleteUserSchema = z.object({
  id: z.string().uuid(),
});

const getPaginatedUsersSchema = z.object({
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).default(10),
});

export const updateUserAction = adminActionClient
  .schema(updateUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, enterprise_id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("users").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    // Gerencia enterprise via junction table
    await ctx.supabaseAdmin.from("user_enterprises").delete().eq("user_id", id);
    if (enterprise_id) {
      const { error: joinError } = await ctx.supabaseAdmin
        .from("user_enterprises")
        .insert({ user_id: id, enterprise_id });
      if (joinError) throw new Error(joinError.message);
    }

    revalidatePath("/users");
    revalidatePath(`/users/${id}`);
    return { success: true };
  });

export const createUserAction = adminActionClient
  .schema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { password, enterprise_id, ...profileData } = parsedInput;

    const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: profileData.email,
      password,
      email_confirm: true,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Falha ao criar usuário");

    const { error: profileError } = await ctx.supabaseAdmin.from("users").insert({
      id: authData.user.id,
      ...profileData,
    });

    if (profileError) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(profileError.message);
    }

    if (enterprise_id) {
      const { error: joinError } = await ctx.supabaseAdmin
        .from("user_enterprises")
        .insert({ user_id: authData.user.id, enterprise_id });
      if (joinError) throw new Error(joinError.message);
    }

    revalidatePath("/users");
    return { success: true, id: authData.user.id };
  });

export const getPaginatedUsersAction = adminActionClient
  .schema(getPaginatedUsersSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { data, error } = await ctx.supabaseAdmin.rpc("get_paginated_users", {
      page: parsedInput.page,
      size: parsedInput.size,
    });

    if (error) throw new Error(error.message);

    const rpcResult = data as {
      data: UserWithEnterprise[];
      pagination: { page: number; size: number; total_pages: number };
    };

    const authResults = await Promise.all(
      rpcResult.data.map((u) => ctx.supabaseAdmin.auth.admin.getUserById(u.id)),
    );

    const confirmedMap = new Map<string, boolean>()
    for (const r of authResults) {
      if (!r.error && r.data.user) {
        confirmedMap.set(r.data.user.id, !!r.data.user.email_confirmed_at)
      }
    }

    return {
      data: rpcResult.data.map((u) => ({
        ...u,
        email_confirmed: confirmedMap.get(u.id) ?? false,
      })),
      pagination: rpcResult.pagination,
    };
  });

export const deleteUserAction = adminActionClient
  .schema(deleteUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("users").delete().eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    await ctx.supabaseAdmin.auth.admin.deleteUser(parsedInput.id);

    revalidatePath("/users");
    return { success: true };
  });
