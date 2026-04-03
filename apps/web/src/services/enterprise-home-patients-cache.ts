import { dayjs } from "@/lib/dayjs";
import { getDppDateRange } from "@/lib/dpp-filter";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientFilter, PatientWithGestationalInfo, TeamMember } from "@/types";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { unstable_cache } from "next/cache";

const TEAM_MEMBERS_SELECT =
  "patient_id, id, professional_id, professional_type, joined_at, is_backup, professional:users!team_members_professional_id_fkey(id, name, email, avatar_url)";

type HomePatientItem = {
  patient: PatientWithGestationalInfo;
  teamMembers: TeamMember[];
};

type RawPatient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  street: string | null;
  neighborhood: string | null;
  complement: string | null;
  number: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  date_of_birth: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string;
  user_id: string | null;
  due_date?: string | null;
  dum?: string | null;
  has_finished?: boolean;
  born_at?: string | null;
  observations?: string | null;
  partner_name?: string | null;
  blood_type?: string | null;
  height_cm?: number | null;
  allergies?: string[] | null;
  personal_notes?: string | null;
  family_history_diabetes?: boolean | null;
  family_history_hypertension?: boolean | null;
  family_history_twin?: boolean | null;
  family_history_others?: string | null;
};

type FetchParams = {
  enterpriseId: string;
  professionalId?: string;
  filter: PatientFilter;
  search: string;
  dppMonth?: number;
  dppYear?: number;
};

async function fetchEnterpriseHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  const { enterpriseId, professionalId, filter, search, dppMonth, dppYear } = params;
  const supabase = await createServerSupabaseAdmin();

  // Step 1: Busca team_members com dados completos — uma única query que serve tanto para
  // derivar os patient IDs quanto para montar o resultado final (elimina a segunda query)
  let allTeamMembers: { patient_id: string; [key: string]: unknown }[];

  if (professionalId) {
    const { data } = await supabase
      .from("team_members")
      .select(TEAM_MEMBERS_SELECT)
      .eq("professional_id", professionalId);
    allTeamMembers = (data ?? []) as typeof allTeamMembers;
  } else {
    const { data: professionals } = await supabase
      .from("users")
      .select("id")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional");

    const professionalIds = (professionals ?? []).map((p) => p.id);
    if (professionalIds.length === 0) return [];

    const { data } = await supabase
      .from("team_members")
      .select(TEAM_MEMBERS_SELECT)
      .in("professional_id", professionalIds);
    allTeamMembers = (data ?? []) as typeof allTeamMembers;
  }

  const allPatientIds = [...new Set(allTeamMembers.map((tm) => tm.patient_id))];
  if (allPatientIds.length === 0) return [];

  // Step 2: Busca pacientes filtrados, com LIMIT 20 aplicado no banco
  let rawPatients: RawPatient[];

  if (dppMonth !== undefined && dppYear !== undefined) {
    const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

    const { data: pregnancies, error: pregError } = await supabase
      .from("pregnancies")
      .select("patient_id, due_date, dum, has_finished, born_at, observations")
      .in("patient_id", allPatientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    if (pregError) throw new Error(pregError.message);

    const filteredByDppIds = (pregnancies ?? []).map((p) => p.patient_id);
    if (filteredByDppIds.length === 0) return [];

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));

    let patientsQuery = supabase.from("patients").select("*").in("id", filteredByDppIds).limit(20);

    if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);

    const { data, error } = await patientsQuery;
    if (error) throw new Error(error.message);

    rawPatients = (data ?? []).map((p) => ({
      ...p,
      due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
      dum: pregnancyByPatient.get(p.id)?.dum ?? null,
      has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
      born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
      observations: pregnancyByPatient.get(p.id)?.observations ?? null,
    }));
  } else {
    const { data, error } = await supabase
      .rpc("get_filtered_patients", {
        patient_ids: allPatientIds,
        filter_type: filter,
        search_query: search,
      })
      .limit(20);

    if (error) throw new Error(error.message);
    rawPatients = (data ?? []) as unknown as RawPatient[];
  }

  if (rawPatients.length === 0) return [];

  // Step 3: Monta mapa de team_members usando os dados já buscados no step 1
  // (sem query adicional ao banco)
  const pagedPatientIds = new Set(rawPatients.map((p) => p.id));
  const teamMembersByPatient = new Map<string, TeamMember[]>();

  for (const tm of allTeamMembers) {
    if (!pagedPatientIds.has(tm.patient_id)) continue;
    const list = teamMembersByPatient.get(tm.patient_id) ?? [];
    list.push(tm as unknown as TeamMember);
    teamMembersByPatient.set(tm.patient_id, list);
  }

  // Step 4: Calcula dados gestacionais e monta resultado
  const today = dayjs();

  return rawPatients.map((patient) => {
    const gestationalAge = calculateGestationalAge(patient.dum ?? null);
    const dueDate = dayjs(patient.due_date);

    const patientWithInfo = {
      ...patient,
      due_date: patient.due_date ?? null,
      dum: patient.dum ?? null,
      has_finished: patient.has_finished ?? false,
      born_at: patient.born_at ?? null,
      observations: patient.observations ?? null,
      weeks: gestationalAge?.weeks ?? 0,
      days: gestationalAge?.days ?? 0,
      remainingDays: Math.max(dueDate.diff(today, "day"), 0),
      progress: gestationalAge ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100) : 0,
      allergies: patient.allergies ?? null,
      blood_type: patient.blood_type ?? null,
      height_cm: patient.height_cm ?? null,
      personal_notes: patient.personal_notes ?? null,
      family_history_diabetes: patient.family_history_diabetes ?? null,
      family_history_hypertension: patient.family_history_hypertension ?? null,
      family_history_twin: patient.family_history_twin ?? null,
      family_history_others: patient.family_history_others ?? null,
      partner_name: patient.partner_name ?? null,
    } as PatientWithGestationalInfo;

    return {
      patient: patientWithInfo,
      teamMembers: teamMembersByPatient.get(patient.id) ?? [],
    };
  });
}

export function getCachedEnterpriseHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  return unstable_cache(
    () => fetchEnterpriseHomePatients(params),
    [
      "enterprise-home-patients",
      params.enterpriseId,
      params.professionalId ?? "all",
      params.filter,
      params.search,
      String(params.dppMonth ?? ""),
      String(params.dppYear ?? ""),
    ],
    {
      tags: [`enterprise-patients-${params.enterpriseId}`],
      revalidate: 300,
    },
  )();
}
