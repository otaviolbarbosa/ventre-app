import { buildContractHeaderBlocks } from "@/lib/contract-header-text";
import {
  buildContractPdfFileName,
  renderContractPdfBuffer,
  sanitizeClausesHtml,
  uploadContractPdf,
} from "@/lib/contract-pdf";
import { getContractHeaderData } from "@/services/base-contract";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: patientId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("*")
      .eq("patient_id", patientId)
      .eq("is_base_contract", false)
      .maybeSingle();

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }
    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado para esta paciente" },
        { status: 404 },
      );
    }

    // Signed contract: always return the stored signed PDF — never re-render,
    // so the downloaded file always matches content_hash
    if (contract.is_signed && contract.signed_document_id) {
      const { data: signedDoc, error: signedDocError } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("id", contract.signed_document_id)
        .single();

      if (signedDocError || !signedDoc) {
        return NextResponse.json({ error: "Documento assinado não encontrado" }, { status: 404 });
      }

      const supabaseAdminForSigned = await createServerSupabaseAdmin();
      const { data: signedDocUrl, error: signedUrlError } = await supabaseAdminForSigned.storage
        .from("patient_documents")
        .createSignedUrl(signedDoc.storage_path, 300, { download: signedDoc.file_name });

      if (signedUrlError || !signedDocUrl) {
        return NextResponse.json({ error: "Erro ao gerar URL de download" }, { status: 500 });
      }

      return NextResponse.json({ document: signedDoc, signedUrl: signedDocUrl.signedUrl });
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, name, email, phone, date_of_birth")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Paciente não encontrada" }, { status: 404 });
    }

    const savedParties = contract.parties_details as
      | import("@/lib/contract-header-text").ContractHeaderBlocks
      | null;

    let headerBlocks: import("@/lib/contract-header-text").ContractHeaderBlocks;

    if (savedParties) {
      // Use the frozen snapshot saved when the contract was last saved
      headerBlocks = savedParties;
    } else {
      // Fallback: rebuild dynamically for contracts created before parties_details was introduced
      let pregnancy: { due_date: string } | null = null;
      if (contract.pregnancy_id) {
        const { data: preg } = await supabase
          .from("pregnancies")
          .select("due_date")
          .eq("id", contract.pregnancy_id)
          .maybeSingle();
        pregnancy = preg ?? null;
      }

      const headerData = await getContractHeaderData();

      if (headerData.type === "enterprise") {
        const { data: teamRows } = await supabase
          .from("team_members")
          .select("users!inner(id, name, professional_type, email, phone)")
          .eq("patient_id", patientId);

        headerData.teamMembers = ((teamRows ?? []) as unknown[]).map((r) => {
          const u = (
            r as {
              users: {
                id: string;
                name: string | null;
                professional_type: string | null;
                email: string | null;
                phone: string | null;
              };
            }
          ).users;
          return {
            id: u.id,
            name: u.name,
            professional_type: u.professional_type,
            email: u.email,
            phone: u.phone,
          };
        });
      }

      headerBlocks = buildContractHeaderBlocks(patient, pregnancy, headerData);
    }

    const buffer = await renderContractPdfBuffer({
      headerBlocks,
      title: contract.title,
      clausesHtml: sanitizeClausesHtml(contract.clauses_html),
    });

    const fileName = buildContractPdfFileName(patient.name);

    const supabaseAdmin = await createServerSupabaseAdmin();
    const { document, storagePath } = await uploadContractPdf({
      supabase,
      supabaseAdmin,
      patientId,
      userId: user.id,
      fileName,
      buffer,
      isImmutable: false,
    });

    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from("patient_documents")
      .createSignedUrl(storagePath, 300, { download: fileName });

    if (signError || !signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar URL de download" }, { status: 500 });
    }

    return NextResponse.json({ document, signedUrl: signedUrl.signedUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[contract/pdf]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
