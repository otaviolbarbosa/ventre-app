"use server";

import { isStaff } from "@/lib/access-control";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const revokeContractAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(
    async ({
      parsedInput: { contractId, patientId },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, fully_signed_at")
        .eq("id", contractId)
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) throw new Error("Contrato não encontrado.");
      if (!existing.fully_signed_at) {
        throw new Error("Só é possível revogar contratos assinados por ambas as partes.");
      }

      if (profile.enterprise_id) {
        if (!isStaff(profile)) {
          throw new Error("Apenas gestores ou secretárias podem revogar o contrato.");
        }
      } else {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("created_by")
          .eq("id", patientId)
          .single();
        if (patientRow?.created_by !== user.id) {
          throw new Error("Apenas a profissional responsável pode revogar o contrato.");
        }
      }

      const { error } = await supabase
        .from("contracts")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
        .eq("id", contractId)
        .is("revoked_at", null);

      if (error) throw new Error("Erro ao revogar contrato. Tente novamente.");

      const { error: resolveError } = await supabaseAdmin
        .from("contract_change_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("contract_id", contractId)
        .eq("status", "pending");

      if (resolveError) {
        console.error(
          "[revokeContractAction] failed to resolve pending change requests",
          resolveError,
        );
      }

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      await captureServerEvent(user.id, "revoke_contract", {
        patient_id: patientId,
        contract_id: contractId,
      });

      return { success: true };
    },
  );
