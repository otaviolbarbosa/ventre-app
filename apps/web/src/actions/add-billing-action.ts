"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createBillingSchema } from "@/lib/validations/billing";
import { createBilling } from "@/services/billing";

export const addBillingAction = authActionClient
  .inputSchema(createBillingSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const billing = await createBilling(supabase, supabaseAdmin, user.id, parsedInput);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", billing.patient_id)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Nova cobrança criada",
        description: patient
          ? `Nova cobrança criada para ${patient.name}`
          : "Nova cobrança criada",
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing.patient_id,
        metadata: { billing_id: billing.id },
      });
    }

    return { billing };
  });
