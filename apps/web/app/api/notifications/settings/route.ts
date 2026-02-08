import { createServerSupabaseClient } from "@nascere/supabase/server";
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

    const { data: settings, error } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      // If no settings exist, create default ones
      if (error.code === "PGRST116") {
        const { data: newSettings, error: insertError } = await supabase
          .from("notification_settings")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ settings: newSettings });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    // Only allow updating known boolean fields
    const allowedFields = [
      "appointment_created",
      "appointment_updated",
      "appointment_cancelled",
      "appointment_reminder",
      "team_invite_received",
      "team_invite_accepted",
      "document_uploaded",
      "evolution_added",
      "dpp_approaching",
    ];

    const updateData: Record<string, boolean | string> = {
      updated_at: new Date().toISOString(),
    };
    for (const field of allowedFields) {
      if (typeof body[field] === "boolean") {
        updateData[field] = body[field];
      }
    }

    const { data: settings, error } = await supabase
      .from("notification_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
