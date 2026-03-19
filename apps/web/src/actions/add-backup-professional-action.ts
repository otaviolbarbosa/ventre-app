"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import type { ProfessionalType } from "@/types";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  professionalId: z.string().uuid("ID do profissional inválido"),
});

export const addBackupProfessionalAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, profile } }) => {
    const { data: pregnancy } = await supabase
      .from("pregnancies")
      .select("id")
      .eq("patient_id", parsedInput.patientId)
      .eq("has_finished", false)
      .single();

    if (!pregnancy) {
      throw new Error("Os dados da gestação não foram encontrados");
    }

    const { data: professional } = await supabaseAdmin
      .from("users")
      .select("professional_type")
      .eq("id", parsedInput.professionalId)
      .single();

    if (!professional) {
      throw new Error("Profissional não encontrado");
    }

    let professionalType = professional.professional_type;

    // se um membro da equipe está tentando adicionar um backup
    if (!isStaff(profile)) {
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("professional_type, pregnancies!team_members_pregnancy_id_fkey!inner(has_finished)")
        .eq("patient_id", parsedInput.patientId)
        .eq("professional_id", profile.id)
        .eq("pregnancies.has_finished", false)
        .single();

      if (!teamMember) throw new Error("Você não faz parte da equipe desta gestante");

      professionalType = teamMember.professional_type;

      const { data: existingBackup } = await supabase
        .from("team_members")
        .select("id")
        .eq("patient_id", parsedInput.patientId)
        .eq("professional_type", profile.professional_type as ProfessionalType)
        .eq("pregnancy_id", pregnancy.id)
        .eq("is_backup", true)
        .single();

      if (existingBackup) {
        throw new Error(
          `Já existe um profissional de backup para esta especialidade: ${profile.professional_type}`,
        );
      }
    }

    const { error } = await supabase.from("team_members").insert({
      patient_id: parsedInput.patientId,
      professional_id: parsedInput.professionalId,
      professional_type: professionalType as ProfessionalType,
      pregnancy_id: pregnancy.id,
      is_backup: true,
    });

    if (error) throw new Error(error.message);

    return { success: true };
  });
