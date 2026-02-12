import type { Invite } from "@/types";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";

type GetMyInvitesResult = {
  invites: Invite[];
  error?: string;
};

export async function getMyInvites(): Promise<GetMyInvitesResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { invites: [], error: "Usuário não encontrado" };
  }

  // Use admin client to bypass RLS — the invited professional is not yet
  // a team member, so RLS on the patients table blocks the JOIN.
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invites, error } = await supabaseAdmin
    .from("team_invites")
    .select(`
      *,
      patient:patients!team_invites_patient_id_fkey(id, name, due_date, dum),
      inviter:users!team_invites_invited_by_fkey(name, professional_type)
    `)
    .eq("invited_professional_id", user.id)
    .eq("status", "pendente")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return { invites: [], error: error.message };
  }

  return { invites: (invites as Invite[]) || [] };
}
