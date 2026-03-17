import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { documentId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // RLS will filter if user doesn't have access
    const { data: document, error } = await supabase
      .from("patient_documents")
      .select("storage_path, file_name")
      .eq("id", documentId)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    // Generate signed URL via admin client
    const supabaseAdmin = await createServerSupabaseAdmin();
    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from("patient_documents")
      .createSignedUrl(document.storage_path, 300);

    if (signError || !signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar URL de download" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl, fileName: document.file_name });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { documentId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Fetch document first to get storage path (RLS will filter by SELECT policy)
    const { data: document, error: fetchError } = await supabase
      .from("patient_documents")
      .select("storage_path")
      .eq("id", documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    // Delete from database (RLS DELETE policy checks uploaded_by = auth.uid())
    const { error: deleteError } = await supabase
      .from("patient_documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Delete from storage via admin client
    const supabaseAdmin = await createServerSupabaseAdmin();
    await supabaseAdmin.storage.from("patient_documents").remove([document.storage_path]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
