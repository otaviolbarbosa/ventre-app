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

  const { data: userTeamMemberships } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", userId);

  const patientIds = (userTeamMemberships ?? []).map((tm) => tm.patient_id);
  if (patientIds.length === 0) return [];

  let rawPatients: RawPatient[];

  if (dppMonth !== undefined && dppYear !== undefined) {
    const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

    let query = supabase
      .from("pregnancies")
      .select(
        "patient_id, due_date, dum, has_finished, born_at, observations, patient:patients!inner(*)",
      )
      .in("patient_id", patientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    if (!showFinished) query = query.eq("has_finished", false);
    if (search) query = query.filter("patient.name", "ilike", `%${search}%`);

    const { data, error } = await query.limit(20);
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) return [];

    rawPatients = data.map(({ patient, due_date, dum, has_finished, born_at, observations }) => ({
      ...(patient as unknown as RawPatient),
      due_date,
      dum,
      has_finished,
      born_at,
      observations,
    }));
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

  const pagedPatientIds = rawPatients.map((p) => p.id);
  const teamMembersByPatient = new Map<string, TeamMember[]>();

  const { data: allTeamMembers } = await supabase
    .from("team_members")
    .select(TEAM_MEMBERS_SELECT)
    .in("patient_id", pagedPatientIds);

  for (const tm of allTeamMembers ?? []) {
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

// unstable_cache must be a stable function reference created at module level.
// Inline creation (inside getCachedHomePatients) creates a new cache namespace on every
// call, causing consistent cache misses. We memoize one cache function per userId so
// the reference is stable and per-user tags remain valid for targeted revalidation.
type CachedFetchFn = (params: FetchParams) => Promise<HomePatientItem[]>
const userCacheFns = new Map<string, CachedFetchFn>()

function getOrCreateUserCacheFn(userId: string): CachedFetchFn {
  if (!userCacheFns.has(userId)) {
    userCacheFns.set(
      userId,
      unstable_cache(fetchHomePatients, ["home-patients", userId], {
        tags: [`home-patients-${userId}`],
        revalidate: 300,
      }),
    )
  }
  return userCacheFns.get(userId) as CachedFetchFn
}

export function getCachedHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  return getOrCreateUserCacheFn(params.userId)(params)
}
