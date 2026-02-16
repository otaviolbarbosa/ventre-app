import type { PatientFilter } from "@/types";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Patient = Tables<"patients">;

const PATIENTS_PER_PAGE = 10;

type GetMyPatientsResult = {
  patients: Patient[];
  totalCount: number;
  error?: string;
};

export async function getMyPatients(
  filter: PatientFilter = "all",
  search = "",
  page = 1,
): Promise<GetMyPatientsResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { patients: [], totalCount: 0, error: "Usuário não encontrado" };
  }

  // Get patients where user is a team member
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", user.id);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

  if (patientIds.length === 0) {
    return { patients: [], totalCount: 0 };
  }

  const offset = (page - 1) * PATIENTS_PER_PAGE;

  const { data } = await supabase.rpc("get_filtered_patients", {
    patient_ids: patientIds,
    filter_type: filter,
    search_query: search,
    page_limit: PATIENTS_PER_PAGE,
    page_offset: offset,
  });

  const rows = (data as (Patient & { total_count: number })[]) || [];
  const totalCount = rows.length > 0 ? Number(rows[0]?.total_count) : 0;

  return { patients: rows, totalCount };
}

export async function getPatientById(patientId: string): Promise<Patient | null> {
  const supabase = await createServerSupabaseClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  return patient;
}
