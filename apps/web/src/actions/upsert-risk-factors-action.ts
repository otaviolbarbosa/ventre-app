"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { riskFactorsSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: riskFactorsSchema,
});

export const upsertRiskFactorsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { pregnancyId, data } = parsedInput;

    const { error } = await supabase.from("pregnancy_risk_factors").upsert(
      {
        pregnancy_id: pregnancyId,
        ...data,
      },
      { onConflict: "pregnancy_id" },
    );

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: pregnancy } = await supabase
        .from("pregnancies")
        .select("patient:patients(id, name)")
        .eq("id", pregnancyId)
        .single();
      const patient = pregnancy?.patient as { id: string; name: string } | null;

      insertActivityLog({
        supabaseAdmin,
        actionName: "Fatores de risco atualizados",
        description: patient
          ? `Fatores de risco de ${patient.name} atualizados`
          : "Fatores de risco atualizados",
        actionType: "clinical",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { pregnancy_id: pregnancyId },
      });
    }

    return { success: true };
  });
