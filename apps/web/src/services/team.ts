import type { TeamMember } from "@/types";
import { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type GetTeamMembersResult = {
  teamMembers: TeamMember[];
  error?: string;
};

export async function getTeamMembers(patientId: string): Promise<GetTeamMembersResult> {
  const supabase = await createServerSupabaseClient();

  const { data: team, error } = await supabase
    .from("team_members")
    .select(`
      *,
      professional:users!team_members_professional_id_fkey(id, name, email, avatar_url)
    `)
    .eq("patient_id", patientId);

  if (error) {
    return { teamMembers: [], error: error.message };
  }

  return { teamMembers: (team as TeamMember[]) || [] };
}

export async function leaveTeam(supabase: SupabaseClient, userId: string, patientId: string) {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("patient_id", patientId)
    .eq("professional_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
