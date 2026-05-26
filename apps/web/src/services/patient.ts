import { PATIENTS_PER_PAGE } from "@/lib/constants";
import { getDppDateRange } from "@/lib/dpp-filter";
import { getServerUser } from "@/lib/server-auth";
import type { CreatePatientInput } from "@/lib/validations/patient";
import type { PatientFilter, TeamMember } from "@/types";
import {
  type createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@ventre/supabase/server";
import type { Enums, Tables, TablesInsert } from "@ventre/supabase/types";

type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type Patient = Tables<"patients">;

export type PatientWithPregnancyFields = Patient & {
  due_date?: string | null;
  dum?: string | null;
  has_finished?: boolean;
  born_at?: string | null;
  delivery_method?: Enums<"delivery_method"> | null;
  observations?: string | null;
};

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
  dppMonth?: number,
  dppYear?: number,
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

  let rows: PatientWithPregnancyFields[] = [];
  let totalCount = 0;

  if (dppMonth !== undefined && dppYear !== undefined) {
    // DPP filter path: query pregnancies directly
    const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

    const { data: pregnancies } = await supabase
      .from("pregnancies")
      .select("patient_id, due_date, dum, has_finished, born_at, observations")
      .in("patient_id", patientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate);

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
    const filteredIds = (pregnancies ?? []).map((p) => p.patient_id);

    if (filteredIds.length === 0) {
      return { patients: [], totalCount: 0, teamMembersMap: {} };
    }

    let patientsQuery = supabase.from("patients").select("*").in("id", filteredIds);
    if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);
    const { data: patientsData } = await patientsQuery;

    rows = (patientsData ?? []).map((p) => ({
      ...p,
      due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
      dum: pregnancyByPatient.get(p.id)?.dum ?? null,
      has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
      born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
      observations: pregnancyByPatient.get(p.id)?.observations ?? null,
    }));
    totalCount = rows.length;
  } else {
    // Standard RPC path
    const offset = (page - 1) * PATIENTS_PER_PAGE;

    const { data } = await supabase.rpc("get_filtered_patients", {
      patient_ids: patientIds,
      filter_type: filter,
      search_query: search,
      page_limit: PATIENTS_PER_PAGE,
      page_offset: offset,
    });

    const rpcRows = (data as (PatientWithPregnancyFields & { total_count: number })[]) || [];
    totalCount = rpcRows.length > 0 ? Number(rpcRows[0]?.total_count) : 0;
    rows = rpcRows;
  }

  const pagePatientIds = rows.map((r) => r.id);
  const teamMembersMap: Record<string, TeamMember[]> = {};

  if (pagePatientIds.length > 0) {
    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select(
        "id, patient_id, professional_id, professional_type, joined_at, is_backup, professional:users(id, name, email, avatar_url)",
      )
      .in("patient_id", pagePatientIds);

    for (const tm of teamMembersData ?? []) {
      const pid = (tm as typeof tm & { patient_id: string }).patient_id;
      if (!teamMembersMap[pid]) teamMembersMap[pid] = [];
      teamMembersMap[pid].push(tm as unknown as TeamMember);
    }
  }

  return { patients: rows, totalCount, teamMembersMap };
}

export async function getDueDatesForUser(userId: string): Promise<{ due_date: string | null }[]> {
  const supabase = await createServerSupabaseClient();
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", userId);
  const patientIds = teamMembers?.map((tm) => tm.patient_id) ?? [];
  if (patientIds.length === 0) return [];
  const { data } = await supabase
    .from("pregnancies")
    .select("due_date")
    .in("patient_id", patientIds);
  return (data ?? []).map((p) => ({ due_date: p.due_date ?? null }));
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
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  data: CreatePatientInput,
) {
  // First selected professional (or the creator) is the responsible professional
  const professionalIds =
    data.professional_ids && data.professional_ids.length > 0
      ? data.professional_ids
      : [userId];
  // professionalIds always has at least one element (userId fallback above)
  const responsibleProfessionalId = professionalIds[0] as string;

  const { data: responsibleProfile } = await supabaseAdmin
    .from("users")
    .select("user_type, professional_type")
    .eq("id", responsibleProfessionalId)
    .single();

  if (responsibleProfile?.user_type !== "professional") {
    throw new Error("Apenas profissionais podem ser responsáveis por pacientes");
  }

  const insertData: TablesInsert<"patients"> = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    partner_name: data.partner_name || null,
    street: data.street,
    neighborhood: data.neighborhood,
    complement: data.complement,
    number: data.number,
    city: data.city,
    state: data.state,
    zipcode: data.zipcode,
    created_by: responsibleProfessionalId,
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
  const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .insert({
      patient_id: patient.id,
      due_date: data.due_date,
      dum: data.dum,
      created_by: responsibleProfessionalId,
      baby_name: data.baby_name || null,
      observations: data.observations,
    } satisfies TablesInsert<"pregnancies">)
    .select("id")
    .single();

  if (pregnancyError) {
    await supabaseAdmin.from("patients").delete().eq("id", patient.id);
    throw new Error(pregnancyError.message);
  }

  // Fetch profiles for all selected professionals and add them as team members
  const { data: profProfiles } = await supabaseAdmin
    .from("users")
    .select("id, professional_type")
    .in("id", professionalIds);

  const profProfileMap = new Map((profProfiles ?? []).map((p) => [p.id, p]));

  for (const profId of professionalIds) {
    const prof = profProfileMap.get(profId);
    if (prof?.professional_type) {
      const { error: teamError } = await supabaseAdmin.from("team_members").insert({
        patient_id: patient.id,
        professional_id: profId,
        professional_type: prof.professional_type,
        pregnancy_id: pregnancy.id,
      } satisfies TablesInsert<"team_members">);

      if (teamError) {
        await supabaseAdmin.from("patients").delete().eq("id", patient.id);
        throw new Error(teamError.message);
      }
    }
  }

  return patient;
}
