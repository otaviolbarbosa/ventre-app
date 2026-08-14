"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { createPatientInviteSchema } from "@/lib/validations/patient-invite";

export const createPatientInviteAction = authActionClient
  .inputSchema(createPatientInviteSchema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    let enterpriseId: string | null = null;
    let professionalIds = parsedInput.professional_ids ?? [];

    if (isStaff(profile)) {
      if (!profile.enterprise_id) {
        throw new Error("Você precisa pertencer a uma empresa para executar esta ação.");
      }
      enterpriseId = profile.enterprise_id;

      if (professionalIds.length > 0) {
        for (const profId of professionalIds) {
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
      professionalIds = [user.id];
    }

    const metadata = {
      professional_ids: professionalIds,
      backup_professional_ids: parsedInput.backup_professional_ids ?? [],
      billing: parsedInput.billing ?? null,
    };

    const { data: invite, error } = await supabaseAdmin
      .from("patient_invite_links")
      .insert({
        invite_type: "new_patient",
        patient_id: null,
        created_by: user.id,
        enterprise_id: enterpriseId,
        name: parsedInput.name,
        email: parsedInput.email || null,
        phone: parsedInput.phone,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { invite };
  });
