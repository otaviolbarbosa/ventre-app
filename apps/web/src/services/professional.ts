import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";

export type EnterpriseProfessional = {
  id: string;
  name: string | null;
  email: string | null;
  professional_type: string | null;
  patient_count: number;
};

export type GetEnterpriseProfessionalsResult = {
  professionals: EnterpriseProfessional[];
  enterpriseToken: string | null;
};

export async function getEnterpriseProfessionals(): Promise<GetEnterpriseProfessionalsResult> {
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = await createServerSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { professionals: [], enterpriseToken: null };

  const { data: currentUser } = await supabase
    .from("users")
    .select("enterprise_id")
    .eq("id", user.id)
    .single();

  if (!currentUser?.enterprise_id) return { professionals: [], enterpriseToken: null };

  const enterpriseId = currentUser.enterprise_id;

  const [{ data: enterprise }, { data: professionals }] = await Promise.all([
    supabase.from("enterprises").select("token").eq("id", enterpriseId).single(),
    supabaseAdmin
      .from("users")
      .select("id, name, email, professional_type")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional"),
  ]);

  if (!professionals || professionals.length === 0) {
    return { professionals: [], enterpriseToken: enterprise?.token ?? null };
  }

  const professionalIds = professionals.map((p) => p.id);

  const { data: teamMembers } = await supabaseAdmin
    .from("team_members")
    .select("patient_id, professional_id")
    .in("professional_id", professionalIds);

  const patientCountByProfessional: Record<string, Set<string>> = {};
  for (const tm of teamMembers ?? []) {
    const bucket = patientCountByProfessional[tm.professional_id];
    if (!bucket) {
      patientCountByProfessional[tm.professional_id] = new Set([tm.patient_id]);
    } else {
      bucket.add(tm.patient_id);
    }
  }

  const professionalsWithCount: EnterpriseProfessional[] = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    professional_type: p.professional_type,
    patient_count: patientCountByProfessional[p.id]?.size ?? 0,
  }));

  return { professionals: professionalsWithCount, enterpriseToken: enterprise?.token ?? null };
}
