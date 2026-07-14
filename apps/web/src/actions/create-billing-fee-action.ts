"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { formatCurrency } from "@/lib/billing/calculations";
import { authActionClient } from "@/lib/safe-action";
import { createBillingFeeSchema } from "@/lib/validations/enterprise-billing-fees";

export const createBillingFeeAction = authActionClient
  .inputSchema(createBillingFeeSchema)
  .action(
    async ({
      parsedInput: { name, fee_type, value },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      if (profile.user_type !== "manager") {
        throw new Error("Apenas gestores podem criar taxas.");
      }

      if (!profile.enterprise_id) {
        throw new Error("Você não está associado a nenhuma organização.");
      }

      const { data: fee, error } = await supabase
        .from("enterprise_billing_fees")
        .insert({
          enterprise_id: profile.enterprise_id,
          name,
          fee_type,
          value,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      insertActivityLog({
        supabaseAdmin,
        actionName: "Taxa de cobrança criada",
        description: `Taxa "${name}" criada (${fee_type === "fixed" ? formatCurrency(value) : `${value}%`})`,
        actionType: "enterprise",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        metadata: { fee_id: fee.id, fee_type, value },
      });

      return { fee };
    },
  );
