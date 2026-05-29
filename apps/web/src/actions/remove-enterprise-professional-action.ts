"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const removeEnterpriseProfessionalAction = authActionClient
  .inputSchema(z.object({ professionalId: z.string().uuid() }))
  .action(async ({ parsedInput: { professionalId }, ctx: { supabaseAdmin, user, profile } }) => {
    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }

    // Verifica se o profissional pertence à empresa via junction table
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("user_enterprises")
      .select("user_id")
      .eq("user_id", professionalId)
      .eq("enterprise_id", profile.enterprise_id)
      .single();

    if (membershipError || !membership) {
      throw new Error("Este profissional não pertence à sua organização.");
    }

    // Verifica user_type via users (para garantir que só profissionais são removidos)
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, user_type, name")
      .eq("id", professionalId)
      .single();

    if (userError || !targetUser) {
      throw new Error("Profissional não encontrado.");
    }

    if (targetUser.user_type !== "professional") {
      throw new Error("Apenas profissionais podem ser removidos pela organização.");
    }

    // Remove da junction table (profissional continua existindo no sistema)
    const { error: deleteError } = await supabaseAdmin
      .from("user_enterprises")
      .delete()
      .eq("user_id", professionalId)
      .eq("enterprise_id", profile.enterprise_id);

    if (deleteError) {
      throw new Error("Erro ao remover profissional.");
    }

    insertActivityLog({
      supabaseAdmin,
      actionName: "Profissional removido da organização",
      description: targetUser.name
        ? `${targetUser.name} removido da organização`
        : "Profissional removido da organização",
      actionType: "enterprise",
      userId: user.id,
      enterpriseId: profile.enterprise_id,
      metadata: { professional_id: professionalId },
    });

    return { success: true };
  });
