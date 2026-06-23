"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { updateBillingFeeSchema } from "@/lib/validations/enterprise-billing-fees";
import { z } from "zod";

const schema = updateBillingFeeSchema.extend({ id: z.string().uuid("ID da taxa inválido") });

export const updateBillingFeeAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput: { id, ...updates }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "manager") {
      throw new Error("Apenas gestores podem editar taxas.");
    }

    if (!profile.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }

    const { data: fee, error } = await supabase
      .from("enterprise_billing_fees")
      .update(updates)
      .eq("id", id)
      .eq("enterprise_id", profile.enterprise_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    insertActivityLog({
      supabaseAdmin,
      actionName: "Taxa de cobrança atualizada",
      description: `Taxa "${fee.name}" atualizada`,
      actionType: "enterprise",
      userId: user.id,
      enterpriseId: profile.enterprise_id,
      metadata: { fee_id: fee.id, ...updates },
    });

    return { fee };
  });
