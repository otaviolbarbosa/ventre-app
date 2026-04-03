import type { ProfessionalType } from "@/types";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const types =
      (searchParams.get("types")?.split(",").filter(Boolean) as ProfessionalType[]) ?? [];

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();

    let query = supabaseAdmin
      .from("users")
      .select("id, name, email, professional_type")
      .eq("user_type", "professional")
      .neq("id", user.id)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);

    if (types.length > 0) {
      query = query.in("professional_type", types);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
