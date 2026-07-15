"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { toggleBillingFeeActiveSchema } from "@/lib/validations/enterprise-billing-fees";

export const toggleBillingFeeActiveAction = authActionClient
  .inputSchema(toggleBillingFeeActiveSchema)
  .action(
    async ({ parsedInput: { id, is_active }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      if (profile.user_type !== "manager") {
        throw new Error("Apenas gestores podem ativar ou desativar taxas.");
      }

      if (!profile.enterprise_id) {
        throw new Error("Você não está associado a nenhuma organização.");
      }

      const { data: fee, error } = await supabase
        .from("enterprise_billing_fees")
        .update({ is_active })
        .eq("id", id)
        .eq("enterprise_id", profile.enterprise_id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      insertActivityLog({
        supabaseAdmin,
        actionName: is_active ? "Taxa de cobrança ativada" : "Taxa de cobrança desativada",
        description: `Taxa "${fee.name}" foi ${is_active ? "ativada" : "desativada"}`,
        actionType: "enterprise",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        metadata: { fee_id: fee.id, is_active },
      });

      return { fee };
    },
  );
