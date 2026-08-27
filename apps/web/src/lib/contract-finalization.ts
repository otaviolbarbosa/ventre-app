import { createHash, randomUUID } from "node:crypto";
import type { ContractCertificateData } from "@/components/shared/contract-certificate-document";
import type { SignatureStamp } from "@/components/shared/contract-pdf-document";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import {
  buildFinalizedContractPdfFileName,
  mergePdfBuffers,
  renderContractCertificateBuffer,
  renderContractPdfBuffer,
  sanitizeClausesHtml,
  uploadContractPdf,
} from "@/lib/contract-pdf";
import { buildSignatureLocalityLine, formatAuditTimestamp } from "@/lib/contract-signature-text";
import { personalDocumentsSchema } from "@/lib/validations/personal-documents";
import { buildVerificationUrl } from "@/lib/verification-url";
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

const NAO_INFORMADO = "[não informado]";

// Called after EITHER party's contract_signatures row is inserted — patient and
// professional can now sign in either order, so whichever signature call happens to
// complete the pair is responsible for triggering this. The internal
// professionalSignature/patientSignature check below is the real gate: it throws
// (caller catches, best-effort) until both rows actually exist, so calling this
// unconditionally after every signature insert is safe.
export async function generateFinalizedContractPdf({
  contract,
  patient,
  supabaseAdmin,
  uploaderId,
}: {
  contract: {
    id: string;
    verification_code: string | null;
    parties_details: unknown;
    title: string;
    clauses_html: string;
    city: string | null;
    state: string | null;
    enterprise_id: string | null;
    signed_at: string | null;
    signed_by: string | null;
    content_hash: string | null;
    original_document_id: string | null;
  };
  patient: { id: string; name: string; email: string | null; cpf: string | null };
  supabaseAdmin: SupabaseAdmin;
  uploaderId: string;
}) {
  if (!contract.verification_code) {
    throw new Error("Contrato sem código de verificação — não é possível gerar o documento final.");
  }

  const { data: signatures } = await supabaseAdmin
    .from("contract_signatures")
    .select("id, signer_role, signer_id, signed_at, signed_ip")
    .eq("contract_id", contract.id)
    .order("signed_at", { ascending: true });

  const professionalSignature = signatures?.find((s) => s.signer_role === "professional");
  const patientSignature = signatures?.find((s) => s.signer_role === "patient");
  if (!professionalSignature || !patientSignature) {
    throw new Error("Assinaturas incompletas — não é possível gerar o documento final.");
  }

  const professionalId = contract.signed_by ?? professionalSignature.signer_id;
  const [{ data: professionalUser }, enterpriseResult] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("name, email, personal_documents")
      .eq("id", professionalId)
      .maybeSingle(),
    contract.enterprise_id
      ? supabaseAdmin
          .from("enterprises")
          .select("name, legal_name")
          .eq("id", contract.enterprise_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const professionalPersonalDocuments = personalDocumentsSchema.safeParse(
    professionalUser?.personal_documents ?? {},
  );
  const professionalName = professionalUser?.name ?? "Profissional";
  const professionalCpf = professionalPersonalDocuments.success
    ? (professionalPersonalDocuments.data.cpf ?? NAO_INFORMADO)
    : NAO_INFORMADO;
  const enterpriseName = enterpriseResult.data?.legal_name ?? enterpriseResult.data?.name ?? null;

  const contratadaStamp: SignatureStamp = {
    signedByName: professionalName,
    signedAtLabel: formatAuditTimestamp(professionalSignature.signed_at),
    signatureId: professionalSignature.id,
  };
  const contratanteStamp: SignatureStamp = {
    signedByName: patient.name,
    signedAtLabel: formatAuditTimestamp(patientSignature.signed_at),
    signatureId: patientSignature.id,
  };

  const finalizedDocumentId = randomUUID();
  const finalizedAt = new Date();
  const verificationUrl = buildVerificationUrl(contract.verification_code);

  const contractBuffer = await renderContractPdfBuffer({
    headerBlocks: contract.parties_details as unknown as ContractHeaderBlocks,
    title: contract.title,
    clausesHtml: sanitizeClausesHtml(contract.clauses_html),
    signature: {
      localityLine: buildSignatureLocalityLine(
        contract.city,
        contract.state,
        contract.signed_at ? new Date(contract.signed_at) : finalizedAt,
      ),
      contratanteName: patient.name,
      contratadaName: enterpriseName ?? professionalName,
      contratanteStamp,
      contratadaStamp,
    },
  });

  const certificateData: ContractCertificateData = {
    documentName: contract.title,
    documentId: finalizedDocumentId,
    documentVerificationCode: contract.verification_code,
    originalHash: contract.content_hash ?? NAO_INFORMADO,
    generatedAtLabel: formatAuditTimestamp(finalizedAt.toISOString()),
    verificationUrl,
    signers: [
      {
        name: patient.name,
        cpf: patient.cpf ?? NAO_INFORMADO,
        roleLabel: "CONTRATANTE",
        representing: null,
      },
      {
        name: professionalName,
        cpf: professionalCpf,
        roleLabel: "CONTRATADA",
        representing: enterpriseName,
      },
    ],
    auditEntries: [
      {
        timestampLabel: contract.signed_at
          ? formatAuditTimestamp(contract.signed_at)
          : formatAuditTimestamp(finalizedAt.toISOString()),
        text: `Documento original de número ${contract.content_hash ?? NAO_INFORMADO} criado por ${professionalName} (email: ${professionalUser?.email ?? NAO_INFORMADO}).`,
      },
      ...(signatures ?? []).map((sig) => {
        const isProfessional = sig.signer_role === "professional";
        const name = isProfessional ? professionalName : patient.name;
        const email = isProfessional
          ? (professionalUser?.email ?? NAO_INFORMADO)
          : (patient.email ?? NAO_INFORMADO);
        const roleLabel = isProfessional ? "CONTRATADA" : "CONTRATANTE";
        return {
          timestampLabel: formatAuditTimestamp(sig.signed_at),
          text: `Parte ${name} (email: ${email}) assinou documento como ${roleLabel} com ID de assinatura ${sig.id}.`,
          subtext: `Autenticação confirmada por: Ciência de assinatura coletada via software, endereço de IP: ${sig.signed_ip ?? NAO_INFORMADO}.`,
        };
      }),
      {
        timestampLabel: formatAuditTimestamp(finalizedAt.toISOString()),
        text: `Processo de assinatura concluído automaticamente a partir da última assinatura coletada. Documento final de número ${finalizedDocumentId} criado automaticamente a partir dos dados fornecidos pelas partes e suas respectivas assinaturas.`,
      },
    ],
  };

  const certificateBuffer = await renderContractCertificateBuffer(certificateData);
  const mergedBuffer = await mergePdfBuffers([contractBuffer, certificateBuffer]);
  // Hash computed once over the merged buffer — never recomputed from a re-render,
  // same reasoning as content_hash on the original document (react-pdf output, and
  // the pdf-lib merge, are not byte-deterministic run to run).
  const finalizedContentHash = createHash("sha256").update(mergedBuffer).digest("hex");

  const { document } = await uploadContractPdf({
    supabase: supabaseAdmin,
    supabaseAdmin,
    patientId: patient.id,
    userId: uploaderId,
    fileName: buildFinalizedContractPdfFileName(patient.name),
    buffer: mergedBuffer,
    isImmutable: true,
    id: finalizedDocumentId,
  });

  const { error: finalizeError } = await supabaseAdmin
    .from("contracts")
    .update({ finalized_document_id: document.id, finalized_content_hash: finalizedContentHash })
    .eq("id", contract.id)
    .is("finalized_document_id", null);

  if (finalizeError) {
    console.error(
      "[generateFinalizedContractPdf] failed to set finalized_document_id",
      finalizeError,
    );
  }
}
