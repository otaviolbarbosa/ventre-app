import type { PatientWithGestationalInfo } from "@/types";
import type { Tables } from "@ventre/supabase/types";
import { dayjs } from "@/lib/dayjs";

interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  label: string;
  fullLabel: string;
}

export function calculateGestationalAge(
  dum: string | Date | null | undefined,
  referenceDate?: string | Date,
): GestationalAge | null {
  if (!dum) return null;

  const lmp = dayjs(dum);
  const reference = dayjs(referenceDate ?? undefined);

  if (!lmp.isValid()) return null;

  const totalDays = reference.diff(lmp, "day");

  if (totalDays < 0) return null;

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  const label = days === 0 ? `${weeks}s` : `${weeks}s ${days}d`;
  const fullLabel = days === 0 ? `${weeks} semanas` : `${weeks} semanas e ${days} dias`;

  return { weeks, days, totalDays, label, fullLabel };
}

export const calculateGestationalProgress = (dum: Date | string, referenceDate?: string | Date) => {
  if (!dum) return 0;

  const lmp = dayjs(dum);
  const reference = dayjs(referenceDate ?? undefined);

  if (!lmp.isValid()) return 0;
  const total = 40 * 7; // 40 weeks x 7 days

  const totalDays = reference.diff(lmp, "day");

  return Math.round((totalDays * 100) / total);
};

export const calculateRemainingDays = (dpp: Date | string, referenceDate?: string) => {
  if (!dpp) return 0;

  const due_date = dayjs(dpp);
  const reference = dayjs(referenceDate ?? undefined);

  if (!due_date.isValid()) return 0;

  const remainingDays = due_date.diff(reference, "day");

  if (remainingDays < 0) {
    return 0;
  }

  return remainingDays;
};

type PregnancyInfo = Pick<
  Tables<"pregnancies">,
  "due_date" | "dum" | "has_finished" | "born_at" | "delivery_method" | "observations"
>;

export function buildPatientWithGestationalInfo(
  patient: Tables<"patients">,
  pregnancy: PregnancyInfo | null | undefined,
): PatientWithGestationalInfo {
  const gestationalAge = calculateGestationalAge(pregnancy?.dum ?? null);

  return {
    ...patient,
    due_date: pregnancy?.due_date ?? null,
    dum: pregnancy?.dum ?? null,
    has_finished: pregnancy?.has_finished ?? false,
    born_at: pregnancy?.born_at ?? null,
    delivery_method: pregnancy?.delivery_method ?? null,
    observations: pregnancy?.observations ?? null,
    weeks: gestationalAge?.weeks ?? 0,
    days: gestationalAge?.days ?? 0,
    remainingDays: calculateRemainingDays(pregnancy?.due_date ?? ""),
    progress: calculateGestationalProgress(pregnancy?.dum ?? ""),
  };
}
