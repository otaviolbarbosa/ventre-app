import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: expiredTeamInvites } = await supabaseAdmin
      .from("team_invites")
      .update({ status: "expirado" })
      .eq("status", "pendente")
      .lt("expires_at", now)
      .select("id");

    const { data: expiredPatientInvites } = await supabaseAdmin
      .from("patient_invite_links")
      .update({ status: "expirado" })
      .eq("status", "pendente")
      .lt("expires_at", now)
      .select("id");

    return NextResponse.json({
      team_invites_expired: expiredTeamInvites?.length ?? 0,
      patient_invite_links_expired: expiredPatientInvites?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
