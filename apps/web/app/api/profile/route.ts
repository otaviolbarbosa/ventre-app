import { createServerSupabaseClient } from "@nascere/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    return NextResponse.json({ profile: user.user_metadata });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone } = body;

    // Validate input
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    // Update user profile
    const { data, error } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        phone: phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
