"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createPatientSchema } from "@/lib/validations/patient";
import { createBilling } from "@/services/billing";
import { createPatient } from "@/services/patient";
import { revalidateTag } from "next/cache";

export const addPatientAction = authActionClient
  .inputSchema(createPatientSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    // When creating on behalf of a professional, verify they belong to the same enterprise
    if (parsedInput.professional_id) {
      if (!isStaff(profile) || parsedInput.professional_id !== profile.id) {
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

    const patient = await createPatient(supabaseAdmin, user.id, parsedInput);

    if (parsedInput.billing) {
      await createBilling(supabase, supabaseAdmin, user.id, {
        ...parsedInput.billing,
        patient_id: patient.id,
      });
    }

    revalidateTag(`home-patients-${user.id}`, { expire: 300 });
    revalidateTag(`home-data-${user.id}`, { expire: 300 });

    if (profile.enterprise_id) {
      revalidateTag(`enterprise-patients-${profile.enterprise_id}`, { expire: 300 });

      insertActivityLog({
        supabaseAdmin,
        actionName: "Nova gestante cadastrada",
        description: `${parsedInput.name} foi cadastrada como nova gestante`,
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient.id,
        metadata: { patient_id: patient.id },
      });
    }

    return { patient };
  });
