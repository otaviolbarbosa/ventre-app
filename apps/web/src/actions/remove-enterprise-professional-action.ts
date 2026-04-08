"use server";

import { authActionClient } from "@/lib/safe-action";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { z } from "zod";

export const removeEnterpriseProfessionalAction = authActionClient
  .inputSchema(z.object({ professionalId: z.string().uuid() }))
  .action(async ({ parsedInput: { professionalId }, ctx: { profile } }) => {
    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }

    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: targetUser, error } = await supabaseAdmin
      .from("users")
      .select("id, user_type, enterprise_id")
      .eq("id", professionalId)
      .single();

    if (error || !targetUser) {
      throw new Error("Profissional não encontrado.");
    }

    if (targetUser.enterprise_id !== profile.enterprise_id) {
      throw new Error("Este profissional não pertence à sua organização.");
    }

    if (targetUser.user_type !== "professional") {
      throw new Error("Apenas profissionais podem ser removidos pela organização.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ enterprise_id: null })
      .eq("id", professionalId);

    if (updateError) {
      throw new Error("Erro ao remover profissional.");
    }

    return { success: true };
  });
