import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import type { EnterpriseProfessional } from "./professional";

export type EnterpriseStaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  user_type: "manager" | "secretary";
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

  const [{ data: professionalsData }, { data: staffData }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, name, email, professional_type")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional"),
    supabaseAdmin
      .from("users")
      .select("id, name, email, user_type")
      .eq("enterprise_id", enterpriseId)
      .in("user_type", ["manager", "secretary"]),
  ]);

  const professionalIds = (professionalsData ?? []).map((p) => p.id);

  const { data: teamMembers } =
    professionalIds.length > 0
      ? await supabaseAdmin
          .from("team_members")
          .select("patient_id, professional_id")
          .in("professional_id", professionalIds)
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
    professional_type: p.professional_type,
    patient_count: patientCountByProfessional[p.id]?.size ?? 0,
  }));

  const staff: EnterpriseStaffMember[] = (staffData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    user_type: s.user_type as "manager" | "secretary",
  }));

  return { professionals, staff, enterpriseId };
}
