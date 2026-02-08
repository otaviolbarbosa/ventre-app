import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Enums, TablesInsert } from "@nascere/supabase/types";
import { NextResponse } from "next/server";
import { sendNotificationToUser } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Get pending invites for this user
    const { data: invites, error } = await supabase
      .from("team_invites")
      .select(`
        *,
        patient:patients(id, name, due_date, dum),
        inviter:users!team_invites_invited_by_fkey(name, professional_type)
      `)
      .eq("invited_professional_id", user.id)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { patient_id, invited_professional_id, professional_type } = body;

    if (!patient_id || !invited_professional_id) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Validate professional_type if provided
    const validTypes: Enums<"professional_type">[] = ["obstetra", "enfermeiro", "doula"];
    if (professional_type && !validTypes.includes(professional_type)) {
      return NextResponse.json({ error: "Tipo de profissional inválido" }, { status: 400 });
    }

    // Check if there's already a team member with this professional type (only if type is provided)
    if (professional_type) {
      const { data: existingMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("professional_type", professional_type)
        .single();

      if (existingMember) {
        return NextResponse.json(
          { error: `Já existe um ${professional_type} na equipe desta paciente` },
          { status: 400 },
        );
      }
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from("team_invites")
      .select("id")
      .eq("patient_id", patient_id)
      .eq("invited_professional_id", invited_professional_id)
      .eq("status", "pendente")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Já existe um convite pendente para este profissional" },
        { status: 400 },
      );
    }

    // Create the invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviteData: TablesInsert<"team_invites"> = {
      patient_id,
      invited_by: user.id,
      invited_professional_id,
      professional_type: professional_type
        ? (professional_type as Enums<"professional_type">)
        : null,
      expires_at: expiresAt.toISOString(),
    };

    const { data: invite, error } = await supabase
      .from("team_invites")
      .insert(inviteData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: notify invited professional
    const [{ data: inviterProfile }, { data: patient }] = await Promise.all([
      supabase.from("users").select("name").eq("id", user.id).single(),
      supabase.from("patients").select("name").eq("id", patient_id).single(),
    ]);

    if (inviterProfile && patient) {
      const template = getNotificationTemplate("team_invite_received", {
        professionalName: inviterProfile.name,
        patientName: patient.name,
      });
      sendNotificationToUser(invited_professional_id, {
        type: "team_invite_received",
        ...template,
        data: { url: "/invites" },
      });
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
