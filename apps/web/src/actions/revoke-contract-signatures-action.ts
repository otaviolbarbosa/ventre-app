"use server";

import { isStaff } from "@/lib/access-control";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const revokeContractSignaturesAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(
    async ({
      parsedInput: { contractId, patientId },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select(
          "id, is_signed, fully_signed_at, title, clauses_html, parties_details, city, state, pregnancy_id, enterprise_id, user_id",
        )
        .eq("id", contractId)
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) throw new Error("Contrato não encontrado.");
      if (existing.fully_signed_at) {
        throw new Error(
          'Contratos totalmente assinados só podem ser revogados pela opção "Revogar e redigir novo contrato".',
        );
      }
      if (!existing.is_signed) {
        // Nothing to revoke — safe no-op so the caller can proceed straight to editing.
        return { contractId: existing.id };
      }

      if (profile.enterprise_id) {
        if (!isStaff(profile)) {
          throw new Error("Apenas gestores ou secretárias podem revogar a assinatura do contrato.");
        }
      } else {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("created_by")
          .eq("id", patientId)
          .single();
        if (patientRow?.created_by !== user.id) {
          throw new Error(
            "Apenas a profissional responsável pode revogar a assinatura do contrato.",
          );
        }
      }

      // contract_signatures rows are immutable and tied to this contract_id, so the
      // only way to invalidate the collected signature is to revoke this row and
      // recreate it with the same (still unedited) content — same
      // revoke-and-recreate pattern as revoke-contract-action.ts and the analogous
      // branch in sign-patient-contract-action.ts.
      const { error: revokeError } = await supabase
        .from("contracts")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
        .eq("id", existing.id)
        .is("revoked_at", null);
      if (revokeError) {
        throw new Error("Erro ao revogar assinatura. Tente novamente.");
      }

      const { error: resolveError } = await supabaseAdmin
        .from("contract_change_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("contract_id", existing.id)
        .eq("status", "pending");
      if (resolveError) {
        console.error(
          "[revokeContractSignaturesAction] failed to resolve pending change requests",
          resolveError,
        );
      }

      const { data: inserted, error } = await supabase
        .from("contracts")
        .insert({
          is_base_contract: false,
          is_active: true,
          title: existing.title,
          clauses_html: existing.clauses_html,
          parties_details: existing.parties_details,
          city: existing.city,
          state: existing.state,
          patient_id: patientId,
          pregnancy_id: existing.pregnancy_id,
          enterprise_id: existing.enterprise_id,
          user_id: existing.user_id,
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Erro ao recriar contrato.");

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      await captureServerEvent(user.id, "revoke_contract_signatures", {
        patient_id: patientId,
        contract_id: existing.id,
        new_contract_id: inserted.id,
      });

      return { contractId: inserted.id };
    },
  );
