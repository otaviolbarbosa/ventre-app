"use server";

import { randomUUID } from "node:crypto";
import type { SignatureStamp } from "@/components/shared/contract-pdf-document";
import { generateFinalizedContractPdf } from "@/lib/contract-finalization";
import { type ContractHeaderBlocks, hasUnfilledFields } from "@/lib/contract-header-text";
import {
  buildContractPdfFileName,
  renderContractPdfBuffer,
  sanitizeClausesHtml,
  uploadContractPdf,
} from "@/lib/contract-pdf";
import { buildSignatureLocalityLine, formatAuditTimestamp } from "@/lib/contract-signature-text";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { signContractAsPatientSchema } from "@/lib/validations/contract";
import { getContratadaNameForContract } from "@/services/base-contract";
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
          "id, status, is_signed, verification_code, parties_details, title, clauses_html, city, state, enterprise_id, user_id, signed_at, signed_by, content_hash, original_document_id",
        )
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .in("status", ["draft", "active"])
        .maybeSingle();

      if (!existing) throw new Error("Nenhum contrato encontrado para assinar.");
      if (existing.status === "draft") {
        throw new Error("Este contrato ainda é um rascunho e não pode ser assinado.");
      }
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

      const signedAt = new Date().toISOString();
      // Pre-generated so the id can be burned into the PDF stamp below before the row
      // referencing it actually exists.
      const patientSignatureId = randomUUID();

      const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
        id: patientSignatureId,
        contract_id: existing.id,
        signer_role: "patient",
        signer_id: user.id,
        signed_at: signedAt,
        signed_ip: signedIp,
        signed_user_agent: signedUserAgent,
        verification_code: existing.verification_code,
      });

      if (signatureInsertError) {
        throw new Error("Erro ao assinar contrato. Tente novamente.");
      }

      // The professional hasn't signed yet — the contract row is still mutable, so
      // regenerate the "original" PDF now to carry the patient's own stamp (otherwise
      // this signature would stay invisible in the document until the professional
      // signs and generateFinalizedContractPdf runs below). Once the professional has
      // signed, the row is immutable and original_document_id already has whichever
      // stamps existed when it was rendered — best-effort, never blocks the signature
      // that's already been recorded.
      if (!existing.is_signed) {
        try {
          const contratanteStamp: SignatureStamp = {
            signedByName: patientRow.name,
            signedAtLabel: formatAuditTimestamp(signedAt),
            signatureId: patientSignatureId,
          };
          const contratadaName = await getContratadaNameForContract({
            enterpriseId: existing.enterprise_id,
            professionalUserId: existing.user_id,
          });

          const buffer = await renderContractPdfBuffer({
            headerBlocks: partiesDetails,
            title: existing.title,
            clausesHtml: sanitizeClausesHtml(existing.clauses_html),
            signature: {
              localityLine: buildSignatureLocalityLine(
                existing.city,
                existing.state,
                new Date(signedAt),
              ),
              contratanteName: patientRow.name,
              contratadaName: contratadaName ?? "Profissional",
              contratanteStamp,
            },
          });

          const { document } = await uploadContractPdf({
            supabase,
            supabaseAdmin,
            patientId,
            userId: user.id,
            fileName: buildContractPdfFileName(patientRow.name),
            buffer,
            isImmutable: false,
          });

          await supabase
            .from("contracts")
            .update({ original_document_id: document.id })
            .eq("id", existing.id);
        } catch (err) {
          console.error(
            "[signContractAsPatientAction] failed to regenerate original PDF with patient stamp",
            err,
          );
        }
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
