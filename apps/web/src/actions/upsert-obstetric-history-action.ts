"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { obstetricHistorySchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
  data: obstetricHistorySchema,
});

export const upsertObstetricHistoryAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { patientId, pregnancyId, data } = parsedInput;
    const {
      gestations_count,
      deliveries_count,
      cesareans_count,
      abortions_count,
      ...historyFields
    } = data;

    const { error } = await supabase.from("patient_obstetric_history").upsert(
      {
        patient_id: patientId,
        ...historyFields,
      },
      { onConflict: "patient_id" },
    );

    if (error) throw new Error(error.message);

    const { error: pregnancyError } = await supabase
      .from("pregnancies")
      .update({
        gestations_count: gestations_count ?? null,
        deliveries_count: deliveries_count ?? null,
        cesareans_count: cesareans_count ?? null,
        abortions_count: abortions_count ?? null,
      })
      .eq("id", pregnancyId);

    if (pregnancyError) throw new Error(pregnancyError.message);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", patientId)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Histórico obstétrico atualizado",
        description: patient
          ? `Histórico obstétrico de ${patient.name} atualizado`
          : "Histórico obstétrico atualizado",
        actionType: "clinical",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId,
        metadata: { pregnancy_id: pregnancyId },
      });
    }

    return { success: true };
  });
