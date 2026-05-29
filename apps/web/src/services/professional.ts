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

  // Profissionais via junction table + enterprise token em paralelo
  const [{ data: enterprise }, { data: ueData }] = await Promise.all([
    supabase.from("enterprises").select("token").eq("id", enterpriseId).single(),
    supabaseAdmin
      .from("user_enterprises")
      .select("user_id, users!inner(id, name, email, phone, professional_type)")
      .eq("enterprise_id", enterpriseId),
  ]);

  const professionals = (ueData ?? []).map((ue) => {
    const u = Array.isArray(ue.users) ? ue.users[0] : ue.users;
    return {
      id: u?.id ?? ue.user_id,
      name: u?.name ?? null,
      email: u?.email ?? null,
      phone: u?.phone ?? null,
      professional_type: u?.professional_type ?? null,
    };
  });

  if (professionals.length === 0) {
    return { professionals: [], enterpriseToken: enterprise?.token ?? null };
  }

  const professionalIds = professionals.map((p) => p.id);

  const teamMembersQuery = supabaseAdmin
    .from("team_members")
    .select("professional_id, pregnancies!inner(id, enterprise_id)")
    .in("professional_id", professionalIds)
    .eq("pregnancies.enterprise_id", enterpriseId);

  if (patientId) {
    teamMembersQuery.eq("patient_id", patientId);
  }

  const { data: teamMembers } = await teamMembersQuery;

  const patientCountByProfessional: Record<string, Set<string>> = {};
  for (const tm of teamMembers ?? []) {
    const pregnancyId = Array.isArray(tm.pregnancies) ? tm.pregnancies[0]?.id : tm.pregnancies?.id;
    if (!pregnancyId) continue;
    const bucket = patientCountByProfessional[tm.professional_id];
    if (!bucket) {
      patientCountByProfessional[tm.professional_id] = new Set([pregnancyId]);
    } else {
      bucket.add(pregnancyId);
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
