import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { EnterpriseProfessional } from "./professional";

export type EnterpriseStaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  user_type: "manager" | "secretary";
  avatar_url?: string;
};

export type EnterpriseUsersResult = {
  professionals: EnterpriseProfessional[];
  staff: EnterpriseStaffMember[];
  enterpriseId: string;
};

export async function getEnterpriseUsers(): Promise<EnterpriseUsersResult> {
  const { profile } = await getServerAuth();
  const supabaseAdmin = await createServerSupabaseAdmin();

  if (!profile?.enterprise_id) {
    return { professionals: [], staff: [], enterpriseId: "" };
  }

  const enterpriseId = profile.enterprise_id;

  // Todos os membros da enterprise via junction table, split por user_type
  const { data: allUeData } = await supabaseAdmin
    .from("user_enterprises")
    .select(
      "user_id, users!inner(id, name, email, phone, professional_type, user_type, avatar_url)",
    )
    .eq("enterprise_id", enterpriseId);

  const ueData = (allUeData ?? []).filter((ue) => {
    const u = Array.isArray(ue.users) ? ue.users[0] : ue.users;
    return u?.user_type === "professional";
  });
  const staffUeData = (allUeData ?? []).filter((ue) => {
    const u = Array.isArray(ue.users) ? ue.users[0] : ue.users;
    return u?.user_type === "manager" || u?.user_type === "secretary";
  });

  const professionalsData = (ueData ?? []).map((ue) => {
    const u = Array.isArray(ue.users) ? ue.users[0] : ue.users;
    return {
      id: u?.id ?? ue.user_id,
      name: u?.name ?? null,
      email: u?.email ?? null,
      phone: u?.phone ?? null,
      professional_type: u?.professional_type ?? null,
      avatar_url: u?.avatar_url ?? null,
    };
  });

  const professionalIds = professionalsData.map((p) => p.id);

  const { data: teamMembers } =
    professionalIds.length > 0
      ? await supabaseAdmin
          .from("team_members")
          .select("patient_id, professional_id, pregnancies!inner(enterprise_id)")
          .in("professional_id", professionalIds)
          .eq("pregnancies.enterprise_id", enterpriseId)
      : { data: [] };

  const patientCountByProfessional: Record<string, Set<string>> = {};
  for (const tm of teamMembers ?? []) {
    const bucket = patientCountByProfessional[tm.professional_id];
    if (!bucket) {
      patientCountByProfessional[tm.professional_id] = new Set([tm.patient_id]);
    } else {
      bucket.add(tm.patient_id);
    }
  }

  const professionals: EnterpriseProfessional[] = (professionalsData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    professional_type: p.professional_type,
    patient_count: patientCountByProfessional[p.id]?.size ?? 0,
    avatar_url: p.avatar_url ?? undefined,
  }));

  const staff: EnterpriseStaffMember[] = (staffUeData ?? []).map((ue) => {
    const s = Array.isArray(ue.users) ? ue.users[0] : ue.users;
    return {
      id: s?.id ?? ue.user_id,
      name: s?.name ?? null,
      email: s?.email ?? null,
      user_type: (s?.user_type ?? "secretary") as "manager" | "secretary",
      avatar_url: s?.avatar_url ?? undefined,
    };
  });

  return { professionals, staff, enterpriseId };
}
