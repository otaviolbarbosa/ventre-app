"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  teamMemberId: z.string().uuid("ID do membro inválido"),
});

export const removeBackupProfessionalAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, patient_id, professional_type, is_backup")
      .eq("id", parsedInput.teamMemberId)
      .single();

    if (!member) throw new Error("Membro não encontrado");

    const { data: myMember } = await supabase
      .from("team_members")
      .select("id, professional_type")
      .eq("patient_id", member.patient_id)
      .eq("professional_id", user.id)
      .eq("is_backup", false)
      .single();

    const isStaff = profile?.user_type && ["manager", "secretary"].includes(profile?.user_type);
    const isSameType = myMember?.professional_type === member.professional_type;

    if (!isStaff && !isSameType) {
      throw new Error("Você não tem permissão para remover este backup");
    }

    if (!isStaff && !member.is_backup) {
      throw new Error("Este membro não é um backup");
    }

    const { error } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("id", parsedInput.teamMemberId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", member.patient_id)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Profissional de backup removido",
        description: patient
          ? `Profissional de backup removido da equipe de ${patient.name}`
          : "Profissional de backup removido",
        actionType: "team",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: member.patient_id,
        metadata: { team_member_id: parsedInput.teamMemberId },
      });
    }

    return { success: true };
  });
