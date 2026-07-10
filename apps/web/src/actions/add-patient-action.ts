"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createPatientSchema } from "@/lib/validations/patient";
import { createPatientWithTeamAndBilling } from "@/services/patient-onboarding";
import { revalidateTag } from "next/cache";

export const addPatientAction = authActionClient
  .inputSchema(createPatientSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    let enterpriseId: string | null = null;

    if (isStaff(profile)) {
      if (!profile.enterprise_id) {
        throw new Error("Você precisa pertencer a uma empresa para executar esta ação.");
      }
      enterpriseId = profile.enterprise_id;

      if (parsedInput.professional_ids && parsedInput.professional_ids.length > 0) {
        for (const profId of parsedInput.professional_ids) {
          const { data: membership } = await supabaseAdmin
            .from("user_enterprises")
            .select("user_id")
            .eq("user_id", profId)
            .eq("enterprise_id", enterpriseId)
            .maybeSingle();

          if (!membership) {
            throw new Error("Uma das profissionais selecionadas não pertence à sua organização.");
          }
        }
      }
    } else {
      enterpriseId = parsedInput.enterprise_id ?? null;
    }

    const { patient } = await createPatientWithTeamAndBilling(
      supabase,
      supabaseAdmin,
      user.id,
      parsedInput,
      enterpriseId,
    );

    revalidateTag(`home-patients-${user.id}`, { expire: 300 });
    revalidateTag(`home-data-${user.id}`, { expire: 300 });

    if (enterpriseId) {
      revalidateTag(`enterprise-patients-${enterpriseId}`, { expire: 300 });

      insertActivityLog({
        supabaseAdmin,
        actionName: "Nova gestante cadastrada",
        description: `${parsedInput.name} foi cadastrada como nova gestante`,
        actionType: "patient",
        userId: user.id,
        enterpriseId,
        patientId: patient.id,
        metadata: { patient_id: patient.id },
      });
    }

    return { patient };
  });
