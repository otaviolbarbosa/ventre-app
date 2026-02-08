import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServerSupabaseAdmin } from "@nascere/supabase/server";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: documents, error } = await supabase
      .from("patient_documents")
      .select("*, uploader:uploaded_by(id, name)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate preview URLs for image documents
    const supabaseAdmin = await createServerSupabaseAdmin();
    const imageDocs = (documents ?? []).filter((d) => d.file_type.startsWith("image/"));

    const previewMap: Record<string, string> = {};
    if (imageDocs.length > 0) {
      const paths = imageDocs.map((d) => d.storage_path);
      const { data: signedUrls } = await supabaseAdmin.storage
        .from("patient_documents")
        .createSignedUrls(paths, 3600);

      if (signedUrls) {
        for (const entry of signedUrls) {
          if (entry.signedUrl) {
            const doc = imageDocs.find((d) => d.storage_path === entry.path);
            if (doc) previewMap[doc.id] = entry.signedUrl;
          }
        }
      }
    }

    const documentsWithPreviews = (documents ?? []).map((doc) => ({
      ...doc,
      preview_url: previewMap[doc.id] ?? null,
    }));

    return NextResponse.json({ documents: documentsWithPreviews, currentUserId: user.id });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: patientId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Envie imagens, PDFs ou documentos Word." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O tamanho máximo é 50MB." },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const storagePath = `${patientId}/${timestamp}_${file.name}`;

    // Upload to storage via admin client (bypasses storage RLS)
    const supabaseAdmin = await createServerSupabaseAdmin();
    const { error: uploadError } = await supabaseAdmin.storage
      .from("patient_documents")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Insert record via regular client (RLS validates permission)
    const { data: document, error: insertError } = await supabase
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
      })
      .select("*, uploader:uploaded_by(id, name)")
      .single();

    if (insertError) {
      // Rollback: delete uploaded file
      await supabaseAdmin.storage.from("patient_documents").remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Generate preview URL for image uploads
    let preview_url: string | null = null;
    if (file.type.startsWith("image/")) {
      const { data: signed } = await supabaseAdmin.storage
        .from("patient_documents")
        .createSignedUrl(storagePath, 3600);
      if (signed) preview_url = signed.signedUrl;
    }

    // Fire-and-forget: notify team about new document
    const [{ data: uploaderProfile }, { data: patient }] = await Promise.all([
      supabase.from("users").select("name").eq("id", user.id).single(),
      supabase.from("patients").select("name").eq("id", patientId).single(),
    ]);

    if (uploaderProfile && patient) {
      const template = getNotificationTemplate("document_uploaded", {
        professionalName: uploaderProfile.name,
        patientName: patient.name,
        documentName: file.name,
      });
      sendNotificationToTeam(patientId, user.id, {
        type: "document_uploaded",
        ...template,
        data: { url: `/patients/${patientId}` },
      });
    }

    return NextResponse.json({ document: { ...document, preview_url } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
