"use server";

import { generateFinalizedContractPdf } from "@/lib/contract-finalization";
import { type ContractHeaderBlocks, hasUnfilledFields } from "@/lib/contract-header-text";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { signContractAsPatientSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export const signContractAsPatientAction = authActionClient
  .inputSchema(signContractAsPatientSchema)
  .action(
    async ({ parsedInput: { patientId }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      if (profile.user_type !== "patient") {
        throw new Error("Apenas a gestante pode assinar como paciente.");
      }

      const { data: patientRow } = await supabase
        .from("patients")
        .select("id, user_id, name, email, cpf")
        .eq("id", patientId)
        .single();

      if (!patientRow || patientRow.user_id !== user.id) {
        throw new Error("Você não tem permissão para assinar este contrato.");
      }

      const { data: existing } = await supabase
        .from("contracts")
        .select(
          "id, is_signed, verification_code, parties_details, title, clauses_html, city, state, enterprise_id, signed_at, signed_by, content_hash, original_document_id",
        )
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) throw new Error("Nenhum contrato encontrado para assinar.");
      // The professional does not need to have signed first — either party can sign
      // in either order. The contract_signatures completion trigger sets
      // fully_signed_at once both rows exist, regardless of which one lands second.

      const { data: alreadySigned } = await supabase
        .from("contract_signatures")
        .select("id")
        .eq("contract_id", existing.id)
        .eq("signer_role", "patient")
        .maybeSingle();

      if (alreadySigned) throw new Error("Você já assinou este contrato.");

      const partiesDetails = existing.parties_details as unknown as ContractHeaderBlocks;
      if (hasUnfilledFields(partiesDetails)) {
        throw new Error("O contrato tem dados pendentes e não pode ser assinado.");
      }

      const h = await headers();
      const signedIp =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
      const signedUserAgent = h.get("user-agent") ?? null;

      const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
        contract_id: existing.id,
        signer_role: "patient",
        signer_id: user.id,
        signed_ip: signedIp,
        signed_user_agent: signedUserAgent,
        verification_code: existing.verification_code,
      });

      if (signatureInsertError) {
        throw new Error("Erro ao assinar contrato. Tente novamente.");
      }

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");
      revalidatePath(`/contrato/${existing.id}`);

      await captureServerEvent(user.id, "sign_contract_as_patient", {
        patient_id: patientId,
        contract_id: existing.id,
      });

      // May or may not be the completing signature — generateFinalizedContractPdf
      // itself checks whether both parties have now signed and no-ops (throws,
      // caught here) otherwise. Failure must never fail the signature itself — the
      // patient's signature is already recorded and immutable — so this whole step
      // is best-effort, matching the notification-enqueue try/catch pattern used
      // elsewhere in the contract signing flow.
      try {
        await generateFinalizedContractPdf({
          contract: existing,
          patient: patientRow,
          supabaseAdmin,
          uploaderId: user.id,
        });
      } catch (err) {
        console.error("[signContractAsPatientAction] finalized PDF generation failed", err);
      }

      return { success: true };
    },
  );
