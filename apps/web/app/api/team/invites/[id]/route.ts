import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import type { TablesInsert } from "@nascere/supabase/types";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verify user is a professional
    const { data: profile } = await supabase
      .from("users")
      .select("user_type, professional_type")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();
    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    // Get the invite — use admin to bypass RLS (link-based invites have no invited_professional_id)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("team_invites")
      .select()
      .eq("id", id)
      .eq("status", "pendente")
      .limit(1);

    if (inviteError || !invite?.[0]) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    // Check if invite has expired
    if (new Date(invite[0].expires_at) < new Date()) {
      await supabase.from("team_invites").update({ status: "expirado" }).eq("id", id);
      return NextResponse.json({ error: "Convite expirado" }, { status: 400 });
    }

    if (action === "accept") {
      // Get professional_type from invite or from user profile
      let professionalType = invite[0].professional_type;

      if (!professionalType) {
        const { data: profile } = await supabase
          .from("users")
          .select("professional_type")
          .eq("id", user.id)
          .single();

        if (!profile?.professional_type) {
          return NextResponse.json(
            { error: "Tipo de profissional não definido no perfil" },
            { status: 400 },
          );
        }

        professionalType = profile.professional_type;
      }

      // Check if there's already a team member with this professional type
      const { data: existingMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("patient_id", invite[0].patient_id)
        .eq("professional_type", professionalType)
        .single();

      if (existingMember) {
        await supabase.from("team_invites").update({ status: "rejeitado" }).eq("id", id);
        return NextResponse.json(
          { error: `Já existe um ${professionalType} na equipe desta paciente` },
          { status: 400 },
        );
      }

      // Add user to team
      const teamMemberData: TablesInsert<"team_members"> = {
        patient_id: invite[0].patient_id,
        professional_id: user.id,
        professional_type: professionalType,
      };

      const { error: teamError } = await supabaseAdmin.from("team_members").insert(teamMemberData);

      if (teamError) {
        return NextResponse.json({ error: teamError.message }, { status: 500 });
      }

      // Update invite status
      await supabase.from("team_invites").update({ status: "aceito" }).eq("id", id);

      return NextResponse.json({ success: true, message: "Convite aceito com sucesso" });
    }

    // Reject the invite
    await supabaseAdmin
      .from("team_invites")
      .update({
        invited_professional_id: user.id,
        professional_type: profile.professional_type,
        status: "rejeitado",
      })
      .eq("id", id);

    return NextResponse.json({ success: true, message: "Convite rejeitado" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
