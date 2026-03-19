"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  professionalId: z.string().uuid("ID do profissional inválido"),
  professionalType: z.enum(["obstetra", "enfermeiro", "doula"]),
  isBackup: z.boolean().default(false),
});

export const addProfessionalToTeamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");

    const { patientId, professionalId, professionalType, isBackup } = parsedInput;

    const { data: pregnancy } = await supabaseAdmin
      .from("pregnancies")
      .select("id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const pregnancyId = pregnancy?.id ?? null;

    const { data: existing } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("patient_id", patientId)
      .eq("professional_type", professionalType)
      .eq("is_backup", isBackup)
      .limit(1);

    if (existing?.[0]) {
      const slot = isBackup ? "backup" : "titular";
      throw new Error(`Já existe um profissional ${slot} para a especialidade ${professionalType}`);
    }

    const { error } = await supabaseAdmin.from("team_members").insert({
      patient_id: patientId,
      professional_id: professionalId,
      professional_type: professionalType,
      is_backup: isBackup,
      pregnancy_id: pregnancyId,
    });

    if (error) throw new Error(error.message);

    return { success: true };
  });
