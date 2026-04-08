import { getDppDateRange } from "@/lib/dpp-filter";
import {
  calculateGestationalAge,
  calculateGestationalProgress,
  calculateRemainingDays,
} from "@/lib/gestational-age";
import type { PatientFilter, PatientWithGestationalInfo, TeamMember } from "@/types";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { unstable_cache } from "next/cache";

const TEAM_MEMBERS_SELECT =
  "patient_id, id, professional_id, professional_type, joined_at, is_backup, professional:users!team_members_professional_id_fkey(id, name, email, avatar_url)";

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
};

type FetchParams = {
  userId: string;
  filter: PatientFilter;
  showFinished: boolean;
  search: string;
  dppMonth?: number;
  dppYear?: number;
};

type HomePatientItem = {
  patient: PatientWithGestationalInfo;
  teamMembers: TeamMember[];
};

async function fetchHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  const { userId, filter, showFinished, search, dppMonth, dppYear } = params;
  const supabase = await createServerSupabaseAdmin();

  const { data: allTeamMembers } = await supabase
    .from("team_members")
    .select(TEAM_MEMBERS_SELECT)
    .eq("professional_id", userId);

  const patientIds = (allTeamMembers ?? []).map((tm) => tm.patient_id);
  if (patientIds.length === 0) return [];

  let rawPatients: RawPatient[];

  if (dppMonth !== undefined && dppYear !== undefined) {
    const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

    let pregnancyQuery = supabase
      .from("pregnancies")
      .select("patient_id, due_date, dum, has_finished, born_at, observations")
      .in("patient_id", patientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    if (!showFinished) {
      pregnancyQuery = pregnancyQuery.eq("has_finished", false);
    }

    const { data: pregnancies, error: pregError } = await pregnancyQuery;
    if (pregError) throw new Error(pregError.message);

    const filteredPatientIds = (pregnancies ?? []).map((p) => p.patient_id);
    if (filteredPatientIds.length === 0) return [];

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));

    let patientsQuery = supabase
      .from("patients")
      .select("*")
      .in("id", filteredPatientIds)
      .limit(20);

    if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);

    const { data, error } = await patientsQuery;
    if (error) throw new Error(error.message);

    rawPatients = (data ?? []).map((p) => {
      const preg = pregnancyByPatient.get(p.id);
      return {
        ...p,
        due_date: preg?.due_date ?? null,
        dum: preg?.dum ?? null,
        has_finished: preg?.has_finished ?? false,
        born_at: preg?.born_at ?? null,
        observations: preg?.observations ?? null,
      };
    });
  } else {
    const { data, error } = await supabase
      .rpc("get_filtered_patients", {
        patient_ids: patientIds,
        filter_type: filter,
        search_query: search,
      })
      .limit(20);

    if (error) throw new Error(error.message);
    rawPatients = (data ?? []) as unknown as RawPatient[];
  }

  if (rawPatients.length === 0) return [];

  const pagedPatientIds = new Set(rawPatients.map((p) => p.id));
  const teamMembersByPatient = new Map<string, TeamMember[]>();

  for (const tm of allTeamMembers ?? []) {
    if (!pagedPatientIds.has(tm.patient_id)) continue;
    const list = teamMembersByPatient.get(tm.patient_id) ?? [];
    list.push(tm as unknown as TeamMember);
    teamMembersByPatient.set(tm.patient_id, list);
  }

  return rawPatients.map((patient) => {
    const gestationalAge = calculateGestationalAge(patient.dum ?? null);

    return {
      patient: {
        ...patient,
        due_date: patient.due_date ?? null,
        dum: patient.dum ?? null,
        has_finished: patient.has_finished ?? false,
        born_at: patient.born_at ?? null,
        observations: patient.observations ?? null,
        weeks: gestationalAge?.weeks ?? 0,
        days: gestationalAge?.days ?? 0,
        remainingDays: calculateRemainingDays(patient.due_date ?? ""),
        progress: calculateGestationalProgress(patient.dum ?? ""),
      } as PatientWithGestationalInfo,
      teamMembers: teamMembersByPatient.get(patient.id) ?? [],
    };
  });
}

export function getCachedHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  return unstable_cache(
    () => fetchHomePatients(params),
    [
      "home-patients",
      params.userId,
      params.filter,
      params.search,
      String(params.showFinished),
      String(params.dppMonth ?? ""),
      String(params.dppYear ?? ""),
    ],
    {
      tags: [`home-patients-${params.userId}`],
      revalidate: 300,
    },
  )();
}
