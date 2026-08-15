"use server";

import { createHash } from "node:crypto";
import { isStaff } from "@/lib/access-control";
import { hasUnfilledFields } from "@/lib/contract-header-text";
import { buildPatientContractParties } from "@/lib/contract-parties";
import {
  buildContractPdfFileName,
  renderContractPdfBuffer,
  sanitizeClausesHtml,
  uploadContractPdf,
} from "@/lib/contract-pdf";
import { buildSignatureLocalityLine } from "@/lib/contract-signature-text";
import { enqueueNotification } from "@/lib/notifications/queue";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { signPatientContractSchema } from "@/lib/validations/contract";
import { generateVerificationCode } from "@/lib/verification-code";
import { buildVerificationUrl } from "@/lib/verification-url";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const MAX_CODE_ATTEMPTS = 5;

export const signPatientContractAction = authActionClient
  .inputSchema(signPatientContractSchema)
  .action(
    async ({
      parsedInput: { patientId, pregnancyId, title, clauses_html, city, state, consent },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, is_signed, fully_signed_at")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.fully_signed_at) {
        throw new Error("Este contrato já foi assinado por ambas as partes.");
      }

      const { patient, parties_details, contratadaName } = await buildPatientContractParties(
        { supabase, supabaseAdmin, profile },
        { patientId, pregnancyId: pregnancyId ?? null },
      );

      if (!patient || !parties_details) throw new Error("Paciente não encontrada");

      if (profile.enterprise_id) {
        if (!isStaff(profile)) {
          throw new Error("Apenas gestores ou secretárias podem assinar pelo lado CONTRATADA.");
        }
      } else {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("created_by")
          .eq("id", patientId)
          .single();
        if (patientRow?.created_by !== user.id) {
          throw new Error("Apenas a profissional responsável pode assinar pelo lado CONTRATADA.");
        }
      }

      if (hasUnfilledFields(parties_details)) {
        throw new Error("Preencha todos os dados obrigatórios antes de assinar o contrato.");
      }

      let contractId: string;
      if (existing?.id && existing.is_signed) {
        // Editing a contract that already has a professional signature collected
        // (but not yet fully_signed_at): contract_signatures rows are immutable and
        // tied to this contract_id, so the only way to invalidate the collected
        // signature is to revoke this row and draft a brand-new one — same
        // revoke-and-recreate pattern as revoke-contract-action.ts.
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
          throw new Error("Erro ao invalidar assinatura anterior. Tente novamente.");
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
            "[signPatientContractAction] failed to resolve pending change requests",
            resolveError,
          );
        }

        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            is_active: true,
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar contrato");
        contractId = inserted.id;
      } else if (existing?.id) {
        const { error } = await supabase
          .from("contracts")
          .update({
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        contractId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            is_active: true,
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar contrato");
        contractId = inserted.id;
      }

      if (!consent) {
        // Professional chose not to sign right now — save the draft and stop here.
        // No PDF/hash/verification_code/contract_signatures are generated, since the
        // patient can only sign once the professional has (sign-contract-as-patient-action.ts).
        revalidatePath(`/patients/${patientId}/profile`);
        revalidatePath("/home");

        await captureServerEvent(user.id, "sign_patient_contract", {
          patient_id: patientId,
          contract_id: contractId,
          signed: false,
        });

        return { success: true };
      }

      const signedAt = new Date().toISOString();

      let verificationCode: string | null = null;
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !verificationCode; attempt++) {
        const candidate = generateVerificationCode();
        const { data: collision } = await supabaseAdmin
          .from("contracts")
          .select("id")
          .eq("verification_code", candidate)
          .maybeSingle();
        if (!collision) verificationCode = candidate;
      }
      if (!verificationCode)
        throw new Error("Erro ao gerar código de verificação. Tente novamente.");

      const buffer = await renderContractPdfBuffer({
        headerBlocks: parties_details,
        title,
        clausesHtml: sanitizeClausesHtml(clauses_html),
        signature: {
          signedByName: profile.name ?? "Profissional",
          signedAtLabel: new Date(signedAt).toLocaleString("pt-BR"),
          verificationCode,
          verificationUrl: buildVerificationUrl(verificationCode),
          localityLine: buildSignatureLocalityLine(city ?? null, state ?? null, new Date(signedAt)),
          contratanteName: patient.name,
          contratadaName: contratadaName ?? "Profissional",
        },
      });

      // Hash computed once over the stored buffer — never recomputed from a
      // re-render (react-pdf output is not byte-deterministic)
      const contentHash = createHash("sha256").update(buffer).digest("hex");

      const h = await headers();
      const signedIp =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
      const signedUserAgent = h.get("user-agent") ?? null;

      const { document, storagePath } = await uploadContractPdf({
        supabase,
        supabaseAdmin,
        patientId,
        userId: user.id,
        fileName: buildContractPdfFileName(patient.name),
        buffer,
        isImmutable: true,
      });

      const { error: signError } = await supabase
        .from("contracts")
        .update({
          is_signed: true,
          signed_at: signedAt,
          signed_by: user.id,
          signed_ip: signedIp,
          signed_user_agent: signedUserAgent,
          content_hash: contentHash,
          verification_code: verificationCode,
          signed_document_id: document.id,
        })
        .eq("id", contractId);

      if (signError) {
        // Compensate: the immutable-doc trigger blocks even service_role,
        // so unflag before deleting the orphaned document
        await supabaseAdmin
          .from("patient_documents")
          .update({ is_immutable: false })
          .eq("id", document.id);
        await supabaseAdmin.from("patient_documents").delete().eq("id", document.id);
        await supabaseAdmin.storage.from("patient_documents").remove([storagePath]);
        throw new Error("Erro ao assinar contrato. Tente novamente.");
      }

      const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
        contract_id: contractId,
        signer_role: "professional",
        signer_id: user.id,
        signed_at: signedAt,
        signed_ip: signedIp,
        signed_user_agent: signedUserAgent,
        verification_code: verificationCode,
      });

      if (signatureInsertError) {
        console.error(
          "[signPatientContractAction] failed to record contract_signatures row",
          signatureInsertError,
        );
      }

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patientId },
        "contract_ready_for_signature",
        { patientName: patient.name },
        { referenceType: "contract", referenceId: contractId },
      ).catch((err) => {
        console.error("[whatsapp] contract_ready_for_signature send failed", err);
      });

      enqueueNotification({
        queueName: "push_notifications",
        notificationType: "contract_ready_for_signature",
        referenceType: "contract",
        referenceId: contractId,
        recipientType: "patient",
        recipientId: patientId,
      }).catch((err) => {
        console.error("[push] contract_ready_for_signature enqueue failed", err);
      });

      await captureServerEvent(user.id, "sign_patient_contract", {
        patient_id: patientId,
        contract_id: contractId,
        signed: true,
      });

      return { success: true };
    },
  );
