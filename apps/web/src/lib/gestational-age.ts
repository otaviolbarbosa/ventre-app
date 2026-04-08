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
