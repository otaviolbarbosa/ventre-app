import type { CreatePatientInput } from "@/lib/validations/patient";
import type { PatientFilter } from "@/types";
import {
  createServerSupabaseClient,
  type createServerSupabaseAdmin,
} from "@nascere/supabase/server";
import type { Tables, TablesInsert } from "@nascere/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

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
    due_date: data.due_date,
    dum: data.dum,
    address: data.address,
    observations: data.observations,
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
