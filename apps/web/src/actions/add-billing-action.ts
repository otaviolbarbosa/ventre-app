"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createBillingSchema } from "@/lib/validations/billing";
import { createBilling } from "@/services/billing";

export const addBillingAction = authActionClient
  .inputSchema(createBillingSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    // enterprise_id: staff usa profile, profissional deriva da gestação ativa do paciente
    let billingEnterpriseId: string | null = profile.enterprise_id ?? null;

    if (!billingEnterpriseId && parsedInput.patient_id) {
      const { data: pregnancy } = await supabase
        .from("pregnancies")
        .select("enterprise_id")
        .eq("patient_id", parsedInput.patient_id)
        .eq("has_finished", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      billingEnterpriseId = pregnancy?.enterprise_id ?? null;
    }

    const billing = await createBilling(
      supabase,
      supabaseAdmin,
      user.id,
      parsedInput,
      billingEnterpriseId,
    );

    if (billingEnterpriseId) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", billing.patient_id)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Nova cobrança criada",
        description: patient ? `Nova cobrança criada para ${patient.name}` : "Nova cobrança criada",
        actionType: "billing",
        userId: user.id,
        enterpriseId: billingEnterpriseId,
        patientId: billing.patient_id,
        metadata: { billing_id: billing.id },
      });
    }

    return { billing };
  });
