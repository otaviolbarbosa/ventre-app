import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
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

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF." },
        { status: 400 },
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo permitido: 10MB." },
        { status: 400 },
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Use admin client to bypass RLS for storage operations
    const supabaseAdmin = await createServerSupabaseAdmin();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("users_avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Erro ao fazer upload do arquivo" }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("users_avatars").getPublicUrl(fileName);

    // Update user profile with new avatar URL
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
