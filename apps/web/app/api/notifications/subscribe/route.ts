import { createServerSupabaseClient } from "@nascere/supabase/server";
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

    const { fcm_token, device_info } = await request.json();

    if (!fcm_token) {
      return NextResponse.json({ error: "Token FCM obrigatório" }, { status: 400 });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          fcm_token,
          device_info: device_info || {},
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
