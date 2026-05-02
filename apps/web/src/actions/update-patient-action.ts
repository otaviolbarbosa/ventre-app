"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { updatePatientSchema } from "@/lib/validations/patient";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  data: updatePatientSchema,
});

export const updatePatientAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { due_date, dum, baby_name, observations, ...patientFields } = parsedInput.data;

    const { data: patient, error } = await supabase
      .from("patients")
      .update(patientFields)
      .eq("id", parsedInput.patientId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Update pregnancy fields if any pregnancy-specific fields were provided
    if (
      due_date !== undefined ||
      dum !== undefined ||
      baby_name !== undefined ||
      observations !== undefined
    ) {
      const pregnancyUpdate: {
        due_date?: string;
        dum?: string;
        baby_name?: string | null;
        observations?: string;
      } = {};
      if (due_date !== undefined) pregnancyUpdate.due_date = due_date;
      if (dum !== undefined) pregnancyUpdate.dum = dum;
      if (baby_name !== undefined) pregnancyUpdate.baby_name = baby_name || null;
      if (observations !== undefined) pregnancyUpdate.observations = observations;

      const { error: pregnancyError } = await supabase
        .from("pregnancies")
        .update(pregnancyUpdate)
        .eq("patient_id", parsedInput.patientId);

      if (pregnancyError) throw new Error(pregnancyError.message);
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Dados da paciente atualizados",
        description: `Dados de ${patient.name} atualizados`,
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { patient_id: parsedInput.patientId },
      });
    }

    return { patient };
  });
