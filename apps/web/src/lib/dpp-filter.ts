import { dayjs } from "@/lib/dayjs";

export type DppDateRange = {
  startDate: string;
  endDate: string;
};

/**
 * Computes the ISO date range (inclusive) for a given DPP month/year.
 * @param dppMonth - 0-indexed month (0 = January)
 * @param dppYear  - full year (e.g. 2025)
 */
export function getDppDateRange(dppMonth: number, dppYear: number): DppDateRange {
  const startDate = dayjs().year(dppYear).month(dppMonth).startOf("month").format("YYYY-MM-DD");
  const endDate = dayjs().year(dppYear).month(dppMonth).endOf("month").format("YYYY-MM-DD");
  return { startDate, endDate };
}

/**
 * The current month's bucket also absorbs overdue pregnancies (due_date before this month
 * that haven't finished yet — has_finished is always false by this point), so callers
 * filtering by the current DPP month must drop the lower due_date bound entirely.
 */
export function isCurrentDppMonth(
  dppMonth: number,
  dppYear: number,
  today: ReturnType<typeof dayjs> = dayjs(),
): boolean {
  return dppMonth === today.month() && dppYear === today.year();
}
