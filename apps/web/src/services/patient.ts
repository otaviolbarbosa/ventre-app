import { getServerUser } from "@/lib/server-auth";
import type { CreatePatientInput } from "@/lib/validations/patient";
import type { PatientFilter, TeamMember } from "@/types";
import {
  type createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@nascere/supabase/server";
import type { Tables, TablesInsert } from "@nascere/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type Patient = Tables<"patients">;

export type PatientWithPregnancyFields = Patient & {
  due_date?: string | null;
  dum?: string | null;
  has_finished?: boolean;
  born_at?: string | null;
  observations?: string | null;
};

const PATIENTS_PER_PAGE = 10;

type GetMyPatientsResult = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  teamMembersMap: Record<string, TeamMember[]>;
  error?: string;
};

export async function getMyPatients(
  filter: PatientFilter = "all",
  search = "",
  page = 1,
): Promise<GetMyPatientsResult> {
  const { supabase, user } = await getServerUser();

  if (!user) {
    return { patients: [], totalCount: 0, teamMembersMap: {}, error: "Usuário não encontrado" };
  }

  // Get patients where user is a team member
  const { data: myTeamMemberships } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", user.id);

  const patientIds = myTeamMemberships?.map((tm) => tm.patient_id) || [];

  if (patientIds.length === 0) {
    return { patients: [], totalCount: 0, teamMembersMap: {} };
  }

  const offset = (page - 1) * PATIENTS_PER_PAGE;

  const { data } = await supabase.rpc("get_filtered_patients", {
    patient_ids: patientIds,
    filter_type: filter,
    search_query: search,
    page_limit: PATIENTS_PER_PAGE,
    page_offset: offset,
  });

  const rows = (data as (PatientWithPregnancyFields & { total_count: number })[]) || [];
  const totalCount = rows.length > 0 ? Number(rows[0]?.total_count) : 0;

  const pagePatientIds = rows.map((r) => r.id);
  const teamMembersMap: Record<string, TeamMember[]> = {};

  if (pagePatientIds.length > 0) {
    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select("id, patient_id, professional_id, professional_type, joined_at, professional:users(id, name, email, avatar_url)")
      .in("patient_id", pagePatientIds);

    for (const tm of teamMembersData ?? []) {
      const pid = (tm as typeof tm & { patient_id: string }).patient_id;
      if (!teamMembersMap[pid]) teamMembersMap[pid] = [];
      teamMembersMap[pid].push(tm as unknown as TeamMember);
    }
  }

  return { patients: rows, totalCount, teamMembersMap };
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

export async function createPatient(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  data: CreatePatientInput,
) {
  // Determine which professional will own this patient
  const targetProfessionalId = data.professional_id ?? userId;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("user_type, professional_type")
    .eq("id", targetProfessionalId)
    .single();

  if (profile?.user_type !== "professional") {
    throw new Error("Apenas profissionais podem ser responsáveis por pacientes");
  }

  const insertData: TablesInsert<"patients"> = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    street: data.street,
    neighborhood: data.neighborhood,
    complement: data.complement,
    number: data.number,
    city: data.city,
    state: data.state,
    zipcode: data.zipcode,
    created_by: targetProfessionalId,
  };

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .insert(insertData)
    .select()
    .single();

  if (patientError) {
    throw new Error(patientError.message);
  }

  // Create pregnancy record with due_date, dum, observations
  const { error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .insert({
      patient_id: patient.id,
      due_date: data.due_date,
      dum: data.dum,
      observations: data.observations,
    } satisfies TablesInsert<"pregnancies">);

  if (pregnancyError) {
    await supabaseAdmin.from("patients").delete().eq("id", patient.id);
    throw new Error(pregnancyError.message);
  }

  if (profile.professional_type) {
    const { error: teamError } = await supabaseAdmin.from("team_members").insert({
      patient_id: patient.id,
      professional_id: targetProfessionalId,
      professional_type: profile.professional_type,
    } satisfies TablesInsert<"team_members">);

    if (teamError) {
      await supabaseAdmin.from("patients").delete().eq("id", patient.id);
      throw new Error(teamError.message);
    }
  }

  return patient;
}
