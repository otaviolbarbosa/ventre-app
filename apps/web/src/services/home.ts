import { dayjs } from "@/lib/dayjs";
import type { PatientWithGestationalInfo } from "@/types";
import type { Tables } from "@ventre/supabase/types";

type Patient = Tables<"patients">;
type Pregnancy = Tables<"pregnancies">;
type Appointment = Tables<"appointments">;

type PatientForHome = Pick<Patient, "id" | "name"> & {
  pregnancies: Pick<Pregnancy, "dum">[];
};

export type HomeAppointment = Appointment & {
  patient: PatientForHome;
};

export type DppByMonth = {
  month: number;
  year: number;
  count: number;
  percentage: number;
};

export type HomeData = {
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

export function buildDppByMonth(
  patients: { due_date?: string | null }[],
  today: ReturnType<typeof dayjs>,
): DppByMonth[] {
  const currentMonth = today.month(); // 0-indexed
  const currentYear = today.year();

  // Count patients per month/year. Overdue pregnancies (due_date before the current
  // month) haven't finished yet by construction — the callers already filter out
  // has_finished patients — so they roll into the current month's bucket instead of
  // being dropped.
  const countMap = new Map<string, number>();
  for (const patient of patients) {
    if (!patient.due_date) continue;
    const dueDate = dayjs(patient.due_date);
    let m = dueDate.month();
    let y = dueDate.year();
    if (y < currentYear || (y === currentYear && m < currentMonth)) {
      m = currentMonth;
      y = currentYear;
    }
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
