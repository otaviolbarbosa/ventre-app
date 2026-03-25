import { dayjs } from "@/lib/dayjs";
import { getDppDateRange } from "@/lib/dpp-filter";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientFilter, PatientWithGestationalInfo } from "@/types";
import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import { unstable_cache } from "next/cache";

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

async function fetchHomePatients(
  userId: string,
  filter: string,
  search: string,
  showFinished: boolean,
  dppMonth: string,
  dppYear: string,
): Promise<PatientWithGestationalInfo[]> {
  const supabase = await createServerSupabaseAdmin();
  const today = dayjs();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", userId);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) ?? [];

  if (patientIds.length === 0) {
    return [];
  }

  let rawPatients: RawPatient[] = [];

  const dppMonthNum = dppMonth !== "" ? Number(dppMonth) : undefined;
  const dppYearNum = dppYear !== "" ? Number(dppYear) : undefined;

  if (dppMonthNum !== undefined && dppYearNum !== undefined) {
    const { startDate, endDate } = getDppDateRange(dppMonthNum, dppYearNum);

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

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
    const filteredPatientIds = (pregnancies ?? []).map((p) => p.patient_id);

    if (filteredPatientIds.length === 0) {
      rawPatients = [];
    } else {
      let patientsQuery = supabase.from("patients").select("*").in("id", filteredPatientIds);
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
    }
  } else {
    const { data, error } = await supabase.rpc("get_filtered_patients", {
      patient_ids: patientIds,
      filter_type: filter as PatientFilter,
      search_query: search,
    });
    if (error) throw new Error(error.message);
    rawPatients = (data ?? []) as unknown as RawPatient[];
  }

  return rawPatients.slice(0, 20).map((patient) => {
    const gestationalAge = calculateGestationalAge(patient.dum ?? null);
    const dueDate = dayjs(patient.due_date);
    const remainingDays = dueDate.diff(today, "day");

    return {
      ...patient,
      due_date: patient.due_date ?? null,
      dum: patient.dum ?? null,
      has_finished: patient.has_finished ?? false,
      born_at: patient.born_at ?? null,
      observations: patient.observations ?? null,
      weeks: gestationalAge?.weeks ?? 0,
      days: gestationalAge?.days ?? 0,
      remainingDays: Math.max(remainingDays, 0),
      progress: gestationalAge ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100) : 0,
    } as PatientWithGestationalInfo;
  });
}

export function getCachedHomePatients(
  userId: string,
  filter: string,
  search: string,
  showFinished: boolean,
  dppMonth?: number,
  dppYear?: number,
): Promise<PatientWithGestationalInfo[]> {
  return unstable_cache(
    () =>
      fetchHomePatients(
        userId,
        filter,
        search,
        showFinished,
        String(dppMonth ?? ""),
        String(dppYear ?? ""),
      ),
    [
      "home-patients",
      userId,
      filter,
      search,
      String(showFinished),
      String(dppMonth ?? ""),
      String(dppYear ?? ""),
    ],
    {
      tags: [`home-patients-${userId}`],
      revalidate: 3600,
    },
  )();
}
