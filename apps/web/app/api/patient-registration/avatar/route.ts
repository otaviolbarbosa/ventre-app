import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

// Self-registration completes the account (patient-register-screen.tsx) before the
// browser necessarily has an authenticated session — email confirmation can be
// required, in which case signInWithPassword() right after signUp() fails and there
// is no cookie/session to authenticate a normal /api/profile/avatar upload with.
// This route instead trusts the same "possession of a just-used invite id" credential
// that completePatientRegistrationAction itself already relies on (public actionClient,
// no session check) — the invite id is only known to the registrant, and used_at is
// only set once completePatientRegistrationAction has already linked patients.user_id.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const inviteId = formData.get("inviteId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    if (!inviteId) {
      return NextResponse.json({ error: "Convite inválido" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF." },
        { status: 400 },
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo permitido: 10MB." },
        { status: 400 },
      );
    }

    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: invite } = await supabaseAdmin
      .from("patient_invite_links")
      .select("id, used_at, patient_id")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite || !invite.used_at || !invite.patient_id) {
      return NextResponse.json({ error: "Convite inválido ou não finalizado" }, { status: 403 });
    }

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("user_id")
      .eq("id", invite.patient_id)
      .maybeSingle();

    if (!patient?.user_id) {
      return NextResponse.json({ error: "Conta ainda não vinculada" }, { status: 403 });
    }

    const userId = patient.user_id;
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("users_avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[patient-registration/avatar] upload error", uploadError);
      return NextResponse.json({ error: "Erro ao fazer upload do arquivo" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("users_avatars").getPublicUrl(fileName);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[patient-registration/avatar] update error", updateError);
      return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (error) {
    console.error("[patient-registration/avatar] unexpected error", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
