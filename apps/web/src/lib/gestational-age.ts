import { dayjs } from "@/lib/dayjs";

interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  label: string;
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

  return { weeks, days, totalDays, label };
}
