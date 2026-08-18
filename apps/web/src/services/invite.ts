import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import type { Database, Tables, TablesInsert } from "@ventre/supabase/types";
import dayjs from "dayjs";
import type { Invite, SentPatientInvite, SentTeamInvite } from "@/types";

type ProfessionalType = Database["public"]["Enums"]["professional_type"];

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type GetInviteByIdResult = {
  data?: Invite;
  error?: string;
};

type GetReceivedInvitesResult = {
  data?: { active: Invite[]; inactive: Invite[] };
  error?: string;
};

export async function getReceivedInvites(): Promise<GetReceivedInvitesResult> {
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
      patient:patients!team_invites_patient_id_fkey(id, name, pregnancies(due_date, dum)),
      inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
    `)
    .eq("invited_professional_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const now = new Date();
  const active: Invite[] = [];
  const inactive: Invite[] = [];

  for (const invite of invites as Invite[]) {
    const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
    (isActive ? active : inactive).push(invite);
  }

  return { data: { active, inactive } };
}

export async function getInviteById(inviteId: string): Promise<GetInviteByIdResult> {
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name, pregnancies(due_date, dum)),
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
      patient:patients!team_invites_patient_id_fkey(id, name, pregnancies(due_date, dum)),
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

type GetSentTeamInvitesResult = {
  data?: { active: SentTeamInvite[]; inactive: SentTeamInvite[] };
  error?: string;
};

export async function getSentTeamInvites(): Promise<GetSentTeamInvitesResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Usuário não encontrado" };
  }

  // Plain client is sufficient here (unlike getReceivedInvites): sending a
  // team invite requires is_team_member(patient_id) at insert time, so RLS
  // already grants this sender the patients JOIN.
  const { data: invites, error } = await supabase
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name),
      invitedProfessional:users!team_invites_invited_professional_id_fkey(id, name, professional_type)
    `)
    .eq("invited_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const now = new Date();
  const active: SentTeamInvite[] = [];
  const inactive: SentTeamInvite[] = [];

  for (const invite of invites as SentTeamInvite[]) {
    const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
    (isActive ? active : inactive).push(invite);
  }

  return { data: { active, inactive } };
}

type GetSentPatientInvitesResult = {
  data?: { active: SentPatientInvite[]; inactive: SentPatientInvite[] };
  error?: string;
};

export async function getSentPatientInvites(): Promise<GetSentPatientInvitesResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Usuário não encontrado" };
  }

  // Plain client is sufficient: SELECT RLS allows created_by = auth.uid();
  // the patients JOIN (link_existing only) is covered by is_team_member,
  // which INSERT already required of this sender.
  const { data: invites, error } = await supabase
    .from("patient_invite_links")
    .select(`
      id, status, invite_type, expires_at, name, email, phone,
      patient:patients!patient_invite_links_patient_id_fkey(id, name)
    `)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const now = new Date();
  const active: SentPatientInvite[] = [];
  const inactive: SentPatientInvite[] = [];

  for (const invite of invites as SentPatientInvite[]) {
    const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
    (isActive ? active : inactive).push(invite);
  }

  return { data: { active, inactive } };
}

export async function createInviteForPatientTeamMember(
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
    .gt("expires_at", new Date().toISOString())
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
    .single();

  if (inviteError || !invite) {
    throw new Error("Convite não encontrado");
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from("team_invites").update({ status: "expirado" }).eq("id", inviteId);
    throw new Error("Convite expirado");
  }

  if (action === "accept") {
    let professionalType = invite.professional_type;

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
      .eq("patient_id", invite.patient_id)
      .eq("professional_type", professionalType)
      .single();

    if (existingMember) {
      await supabase.from("team_invites").update({ status: "rejeitado" }).eq("id", inviteId);
      throw new Error(`Já existe um ${professionalType} na equipe desta paciente`);
    }

    const { data: pregnancy } = await supabaseAdmin
      .from("pregnancies")
      .select("id")
      .eq("patient_id", invite.patient_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!pregnancy?.id) throw new Error("Paciente não possui gestação registrada");

    const { error: teamError } = await supabaseAdmin.from("team_members").insert({
      patient_id: invite.patient_id,
      professional_id: profile.id,
      professional_type: professionalType,
      pregnancy_id: pregnancy.id,
    } satisfies TablesInsert<"team_members">);

    if (teamError) {
      throw new Error(teamError.message);
    }

    await supabase.from("team_invites").update({ status: "aceito" }).eq("id", inviteId);

    return { patientId: invite.patient_id };
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

export async function resendTeamInvite(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  inviteId: string,
) {
  const { data: invite, error: inviteError } = await supabase
    .from("team_invites")
    .select("id, status, patient_id")
    .eq("id", inviteId)
    .eq("invited_by", userId)
    .single();

  if (inviteError || !invite) {
    throw new Error("Convite não encontrado");
  }

  if (invite.status === "aceito") {
    throw new Error("Este convite já foi aceito");
  }

  const newExpiresAt = dayjs().add(4, "days").toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("team_invites")
    .update({ status: "pendente", expires_at: newExpiresAt })
    .eq("id", inviteId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { patientId: invite.patient_id, expiresAt: newExpiresAt };
}

export async function reactivateExpiredTeamInvite(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  inviteId: string,
) {
  const { data: invite, error: inviteError } = await supabase
    .from("team_invites")
    .select("id, status, patient_id")
    .eq("id", inviteId)
    .eq("invited_by", userId)
    .single();

  if (inviteError || !invite) {
    throw new Error("Convite não encontrado");
  }

  if (invite.status !== "expirado") {
    throw new Error("Apenas convites expirados podem ser reativados");
  }

  const newExpiresAt = dayjs().add(7, "days").toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("team_invites")
    .update({ status: "pendente", expires_at: newExpiresAt })
    .eq("id", inviteId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { patientId: invite.patient_id, expiresAt: newExpiresAt };
}
