import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";

export type ChartPoint = { x: number; y: number };

export function resolveChartT0(events: BirthModeTimelineEvent[]): number | null {
  const startEvent = events.find((event) => event.type === "start_monitoring");
  const candidates = [startEvent?.occurredAt, ...events.map((event) => event.occurredAt)].filter(
    (value): value is string => value != null,
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates.map((iso) => new Date(iso).getTime()));
}

export function hoursSince(t0: number, iso: string): number {
  return (new Date(iso).getTime() - t0) / (1000 * 60 * 60);
}
