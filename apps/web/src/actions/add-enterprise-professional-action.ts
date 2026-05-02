"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { z } from "zod";

export const addEnterpriseProfessionalAction = authActionClient
  .inputSchema(z.object({ email: z.string().email() }))
  .action(async ({ parsedInput: { email }, ctx: { user, profile } }) => {
    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }

    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: targetUser, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, user_type, enterprise_id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !targetUser) {
      throw new Error("Nenhum usuário encontrado com esse e-mail.");
    }

    if (targetUser.user_type !== "professional") {
      throw new Error("O usuário encontrado não é um profissional.");
    }

    if (targetUser.id === user.id) {
      throw new Error("Você não pode adicionar a si mesmo.");
    }

    if (targetUser.enterprise_id === profile.enterprise_id) {
      throw new Error("Este profissional já pertence à sua organização.");
    }

    if (targetUser.enterprise_id) {
      throw new Error("Este profissional já está vinculado a outra organização.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ enterprise_id: profile.enterprise_id })
      .eq("id", targetUser.id);

    if (updateError) {
      throw new Error("Erro ao adicionar profissional.");
    }

    insertActivityLog({
      supabaseAdmin,
      actionName: "Profissional adicionada à organização",
      description: `${targetUser.name} foi adicionada à organização`,
      actionType: "enterprise",
      userId: user.id,
      enterpriseId: profile.enterprise_id,
      metadata: { professional_id: targetUser.id, professional_email: targetUser.email },
    });

    return { name: targetUser.name, email: targetUser.email };
  });
