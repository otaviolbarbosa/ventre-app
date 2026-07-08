"use server";

import { createHash } from "node:crypto";
import { buildPatientContractParties } from "@/lib/contract-parties";
import {
  buildContractPdfFileName,
  renderContractPdfBuffer,
  sanitizeClausesHtml,
  uploadContractPdf,
} from "@/lib/contract-pdf";
import { buildSignatureLocalityLine } from "@/lib/contract-signature-text";
import { authActionClient } from "@/lib/safe-action";
import { generateVerificationCode } from "@/lib/verification-code";
import { buildVerificationUrl } from "@/lib/verification-url";
import { signPatientContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const MAX_CODE_ATTEMPTS = 5;

export const signPatientContractAction = authActionClient
  .inputSchema(signPatientContractSchema)
  .action(
    async ({
      parsedInput: { patientId, pregnancyId, title, clauses_html, city, state },
      ctx: { supabase, supabaseAdmin, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, is_signed")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.is_signed) throw new Error("Este contrato já foi assinado");

      const { patient, parties_details, contratadaName } = await buildPatientContractParties(
        { supabase, supabaseAdmin, profile },
        { patientId, pregnancyId: pregnancyId ?? null },
      );

      if (!patient || !parties_details) throw new Error("Paciente não encontrada");

      let contractId: string;
      if (existing?.id) {
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
      if (!verificationCode) throw new Error("Erro ao gerar código de verificação. Tente novamente.");

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

      revalidatePath(`/patients/${patientId}/profile`);
      return { success: true };
    },
  );
