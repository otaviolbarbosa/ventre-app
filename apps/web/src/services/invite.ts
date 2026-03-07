import type { Invite } from "@/types";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import type { Database, Tables, TablesInsert } from "@nascere/supabase/types";
import dayjs from "dayjs";

type ProfessionalType = Database["public"]["Enums"]["professional_type"];

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type GetMyInvitesResult = {
  data?: Invite[];
  error?: string;
};

type GetInviteByIdResult = {
  data?: Invite;
  error?: string;
};

export async function getMyInvites(): Promise<GetMyInvitesResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Usuário não encontrado" };
  }

  // Use admin client to bypass RLS — the invited professional is not yet
  // a team member, so RLS on the patients table blocks the JOIN.
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invites, error } = await supabaseAdmin
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name, due_date, dum),
      inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
    `)
    .eq("invited_professional_id", user.id)
    .eq("status", "pendente")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data: invites as Invite[] };
}

export async function getInviteById(inviteId: string): Promise<GetInviteByIdResult> {
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name, due_date, dum),
      inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
    `)
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    return { error: "Convite não encontrado" };
  }

  return { data: invite as Invite };
}

export async function getPendingInviteById(inviteId: string): Promise<GetInviteByIdResult> {
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name, due_date, dum),
      inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
    `)
    .eq("id", inviteId)
    .eq("status", "pendente")
    .single();

  if (error || !invite) {
    return { error: "Convite não encontrado" };
  }

  return { data: invite as Invite };
}

export async function createInviteForPatient(
  supabase: SupabaseClient,
  userId: string,
  patientId: string,
) {
  const { data: pendingInvites } = await supabase
    .from("team_invites")
    .select()
    .eq("patient_id", patientId)
    .eq("invited_by", userId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(1);

  if (pendingInvites?.[0]) {
    return pendingInvites[0];
  }

  const { data: invite, error: inviteError } = await supabase
    .from("team_invites")
    .insert({
      patient_id: patientId,
      invited_by: userId,
      expires_at: dayjs().add(4, "days").toISOString(),
    })
    .select()
    .single();

  if (inviteError || !invite) {
    throw new Error(inviteError?.message ?? "Erro ao cadastrar convite");
  }

  return invite;
}

export async function respondToInvite(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  profile: Tables<"users">,
  inviteId: string,
  action: "accept" | "reject",
) {
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("team_invites")
    .select()
    .eq("id", inviteId)
    .eq("status", "pendente")
    .limit(1);

  if (inviteError || !invite?.[0]) {
    throw new Error("Convite não encontrado");
  }

  if (new Date(invite[0].expires_at) < new Date()) {
    await supabase.from("team_invites").update({ status: "expirado" }).eq("id", inviteId);
    throw new Error("Convite expirado");
  }

  if (action === "accept") {
    let professionalType = invite[0].professional_type;

    if (!professionalType) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("professional_type")
        .eq("id", profile.id)
        .single();

      if (!userProfile?.professional_type) {
        throw new Error("Tipo de profissional não definido no perfil");
      }

      professionalType = userProfile.professional_type;
    }

    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("patient_id", invite[0].patient_id)
      .eq("professional_type", professionalType)
      .single();

    if (existingMember) {
      await supabase.from("team_invites").update({ status: "rejeitado" }).eq("id", inviteId);
      throw new Error(`Já existe um ${professionalType} na equipe desta paciente`);
    }

    const { error: teamError } = await supabaseAdmin.from("team_members").insert({
      patient_id: invite[0].patient_id,
      professional_id: profile.id,
      professional_type: professionalType,
    } satisfies TablesInsert<"team_members">);

    if (teamError) {
      throw new Error(teamError.message);
    }

    await supabase.from("team_invites").update({ status: "aceito" }).eq("id", inviteId);

    return { patientId: invite[0].patient_id };
  }

  await supabaseAdmin
    .from("team_invites")
    .update({
      invited_professional_id: profile.id,
      professional_type: (profile.professional_type as ProfessionalType) ?? null,
      status: "rejeitado",
    })
    .eq("id", inviteId);

  return { patientId: null };
}
