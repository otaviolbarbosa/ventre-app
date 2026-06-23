import { dayjs } from "../dayjs";

export type BillingPeriod =
  | "last_week"
  | "next_week"
  | "last_month"
  | "next_month"
  | "last_quarter"
  | "next_quarter";

export function getPeriodRange(period: BillingPeriod): { startDate: string; endDate: string } {
  const fmt = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");
  const today = dayjs();

  switch (period) {
    case "last_week":
      return { startDate: fmt(today.subtract(1, "week")), endDate: fmt(today) };
    case "next_week":
      return { startDate: fmt(today), endDate: fmt(today.add(1, "week")) };
    case "last_month":
      return {
        startDate: fmt(today.subtract(1, "month").startOf("month")),
        endDate: fmt(today.subtract(1, "month").endOf("month")),
      };
    case "next_month":
      return {
        startDate: fmt(today.add(1, "month").startOf("month")),
        endDate: fmt(today.add(1, "month").endOf("month")),
      };
    case "last_quarter":
      return { startDate: fmt(today.subtract(3, "month")), endDate: fmt(today) };
    case "next_quarter":
      return { startDate: fmt(today), endDate: fmt(today.add(3, "month")) };
  }
}

export function getMonthRange(month: string): { startDate: string; endDate: string } {
  const fmt = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");
  const m = dayjs(month);
  return {
    startDate: fmt(m.startOf("month")),
    endDate: fmt(m.endOf("month")),
  };
}
