"use server";

import { isStaff } from "@/lib/access-control";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { resolveContractChangeRequestSchema } from "@/lib/validations/contract-change-request";
import { revalidatePath } from "next/cache";

export const resolveContractChangeRequestAction = authActionClient
  .inputSchema(resolveContractChangeRequestSchema)
  .action(
    async ({
      parsedInput: { requestId, patientId },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      if (profile.enterprise_id) {
        if (!isStaff(profile)) {
          throw new Error("Apenas gestores ou secretárias podem resolver solicitações de alteração.");
        }
      } else {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("created_by")
          .eq("id", patientId)
          .single();
        if (patientRow?.created_by !== user.id) {
          throw new Error("Apenas a profissional responsável pode resolver esta solicitação.");
        }
      }

      const { data: existing } = await supabase
        .from("contract_change_requests")
        .select("id, status, patient_id")
        .eq("id", requestId)
        .eq("patient_id", patientId)
        .maybeSingle();

      if (!existing) throw new Error("Solicitação não encontrada.");
      if (existing.status === "resolved") throw new Error("Solicitação já foi resolvida.");

      const { error } = await supabaseAdmin
        .from("contract_change_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", requestId);

      if (error) throw new Error("Erro ao resolver solicitação. Tente novamente.");

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      await captureServerEvent(user.id, "resolve_contract_change_request", {
        patient_id: patientId,
        request_id: requestId,
      });

      return { success: true };
    },
  );
