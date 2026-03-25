import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientWithGestationalInfo } from "@/types";
import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";
import { unstable_cache } from "next/cache";

type Patient = Tables<"patients">;
type Pregnancy = Tables<"pregnancies">;
type Appointment = Tables<"appointments">;

type PatientForHome = Pick<Patient, "id" | "name"> & {
  pregnancies: Pick<Pregnancy, "dum">[];
};

export type HomeAppointment = Appointment & {
  patient: PatientForHome;
};

export type TrimesterCounts = {
  first: number;
  second: number;
  third: number;
};

export type DppByMonth = {
  month: number;
  year: number;
  count: number;
  percentage: number;
};

export type HomeData = {
  trimesterCounts: TrimesterCounts;
  dppByMonth: DppByMonth[];
  patients: PatientWithGestationalInfo[];
  upcomingAppointments: HomeAppointment[];
};

export const MONTH_LABELS_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function buildDppByMonth(patients: { due_date?: string | null }[], today: ReturnType<typeof dayjs>): DppByMonth[] {
  const currentMonth = today.month(); // 0-indexed
  const currentYear = today.year();

  // Count patients per month/year
  const countMap = new Map<string, number>();
  for (const patient of patients) {
    if (!patient.due_date) continue;
    const dueDate = dayjs(patient.due_date);
    const m = dueDate.month();
    const y = dueDate.year();
    // Only count from current month onwards
    if (y < currentYear || (y === currentYear && m < currentMonth)) continue;
    const key = `${y}-${m}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Build a range: from current month to max due_date month, at least 4 months
  let maxYear = currentYear;
  let maxMonth = currentMonth + 3; // at least 4 months ahead
  for (const patient of patients) {
    if (!patient.due_date) continue;
    const dueDate = dayjs(patient.due_date);
    const m = dueDate.month();
    const y = dueDate.year();
    if (y > maxYear || (y === maxYear && m > maxMonth)) {
      maxYear = y;
      maxMonth = m;
    }
  }

  const result: DppByMonth[] = [];
  let y = currentYear;
  let m = currentMonth;
  let prevCount = null;
  while (y < maxYear || (y === maxYear && m <= maxMonth)) {
    const key = `${y}-${m}`;
    const currentCount = countMap.get(key) ?? 0;

    result.push({
      month: m,
      year: y,
      count: currentCount,
      percentage:
        prevCount == null || prevCount === 0
          ? 0
          : Math.round(((currentCount - prevCount) * 100) / prevCount),
    });

    prevCount = currentCount;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  return result;
}

function getTrimester(weeks: number): 1 | 2 | 3 | null {
  if (weeks < 0 || weeks > 42) return null;
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

async function fetchHomeData(userId: string): Promise<HomeData> {
  const supabase = await createServerSupabaseAdmin();
  const today = dayjs();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", userId);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

  if (patientIds.length === 0) {
    return {
      trimesterCounts: { first: 0, second: 0, third: 0 },
      dppByMonth: buildDppByMonth([], today),
      patients: [],
      upcomingAppointments: [],
    };
  }

  const { data: patients } = await supabase
    .from("patients")
    .select("*, pregnancies!inner(due_date, dum, has_finished, born_at, observations)")
    .in("id", patientIds)
    .eq("pregnancies.has_finished", false);

  const sortedPatients = (patients || []).slice().sort((a, b) => {
    const aDate = a.pregnancies?.[0]?.due_date ?? "";
    const bDate = b.pregnancies?.[0]?.due_date ?? "";
    return aDate.localeCompare(bDate);
  });

  const trimesterCounts: TrimesterCounts = { first: 0, second: 0, third: 0 };
  const patientsWithInfo: PatientWithGestationalInfo[] = [];

  for (const patient of sortedPatients) {
    const pregnancy = patient.pregnancies?.[0];
    const gestationalAge = calculateGestationalAge(pregnancy?.dum ?? null);
    if (gestationalAge) {
      const trimester = getTrimester(gestationalAge.weeks);
      if (trimester === 1) trimesterCounts.first++;
      else if (trimester === 2) trimesterCounts.second++;
      else if (trimester === 3) trimesterCounts.third++;

      const dueDate = dayjs(pregnancy?.due_date);
      const remainingDays = Math.max(dueDate.diff(today, "day"), 0);

      patientsWithInfo.push({
        ...patient,
        due_date: pregnancy?.due_date ?? null,
        dum: pregnancy?.dum ?? null,
        has_finished: pregnancy?.has_finished ?? false,
        born_at: pregnancy?.born_at ?? null,
        observations: pregnancy?.observations ?? null,
        weeks: gestationalAge.weeks,
        days: gestationalAge.days,
        remainingDays,
        progress: Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100),
      });
    }
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patient:patients!appointments_patient_id_fkey(id, name, pregnancies(dum))
    `,
    )
    .eq("professional_id", userId)
    .gte("date", today.format("YYYY-MM-DD"))
    .eq("status", "agendada")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(5);

  const patientsForDpp = (patients || []).map((p) => ({
    due_date: p.pregnancies?.[0]?.due_date ?? null,
  }));

  return {
    trimesterCounts,
    dppByMonth: buildDppByMonth(patientsForDpp, today),
    patients: patientsWithInfo.slice(0, 5),
    upcomingAppointments: (appointments as HomeAppointment[]) || [],
  };
}

export function getCachedHomeData(userId: string): Promise<HomeData> {
  return unstable_cache(() => fetchHomeData(userId), ["home-data", userId], {
    tags: [`home-data-${userId}`],
    revalidate: 3600,
  })();
}
