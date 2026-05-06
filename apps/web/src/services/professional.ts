import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type EnterpriseProfessional = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  professional_type: string | null;
  patient_count: number;
  avatar_url?: string;
};

export type GetEnterpriseProfessionalsResult = {
  professionals: EnterpriseProfessional[];
  enterpriseToken: string | null;
};

export async function getEnterpriseProfessionals(
  patientId?: string,
): Promise<GetEnterpriseProfessionalsResult> {
  const { supabase, profile } = await getServerAuth();
  const supabaseAdmin = await createServerSupabaseAdmin();

  if (!profile?.enterprise_id) return { professionals: [], enterpriseToken: null };

  const enterpriseId = profile.enterprise_id;

  const [{ data: enterprise }, { data: professionals }] = await Promise.all([
    supabase.from("enterprises").select("token").eq("id", enterpriseId).single(),
    supabaseAdmin
      .from("users")
      .select("id, name, email, phone, professional_type")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional"),
  ]);

  if (!professionals || professionals.length === 0) {
    return { professionals: [], enterpriseToken: enterprise?.token ?? null };
  }

  const professionalIds = professionals.map((p) => p.id);

  const teamMembersQuery = supabaseAdmin
    .from("team_members")
    .select("patient_id, professional_id")
    .in("professional_id", professionalIds);

  if (patientId) {
    teamMembersQuery.eq("patient_id", patientId);
  }

  const { data: teamMembers } = await teamMembersQuery;

  const patientCountByProfessional: Record<string, Set<string>> = {};
  for (const tm of teamMembers ?? []) {
    const bucket = patientCountByProfessional[tm.professional_id];
    if (!bucket) {
      patientCountByProfessional[tm.professional_id] = new Set([tm.patient_id]);
    } else {
      bucket.add(tm.patient_id);
    }
  }

  const teamProfessionalIds = patientId
    ? new Set((teamMembers ?? []).map((tm) => tm.professional_id))
    : null;

  const professionalsWithCount: EnterpriseProfessional[] = professionals
    .filter((p) => !teamProfessionalIds || teamProfessionalIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      professional_type: p.professional_type,
      patient_count: patientCountByProfessional[p.id]?.size ?? 0,
    }));

  return { professionals: professionalsWithCount, enterpriseToken: enterprise?.token ?? null };
}
