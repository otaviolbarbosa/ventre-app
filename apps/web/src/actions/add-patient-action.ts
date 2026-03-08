"use server";

import { authActionClient } from "@/lib/safe-action";
import { createPatientSchema } from "@/lib/validations/patient";
import { createPatient } from "@/services/patient";

export const addPatientAction = authActionClient
  .inputSchema(createPatientSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    // When creating on behalf of a professional, verify they belong to the same enterprise
    if (parsedInput.professional_id) {
      if (!profile.enterprise_id) {
        throw new Error("Sem permissão para criar pacientes em nome de outro profissional.");
      }

      const { data: targetProfessional } = await supabase
        .from("users")
        .select("enterprise_id")
        .eq("id", parsedInput.professional_id)
        .single();

      if (targetProfessional?.enterprise_id !== profile.enterprise_id) {
        throw new Error("O profissional selecionado não pertence à sua organização.");
      }
    }

    const patient = await createPatient(supabase, supabaseAdmin, user.id, parsedInput);
    return { patient };
  });
