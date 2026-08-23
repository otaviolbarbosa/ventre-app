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

export function computeAlertActionLines(
  dilationPoints: ChartPoint[],
  dilationMax: number,
): { alertLine: ChartPoint[]; actionLine: ChartPoint[] } {
  const activePhaseStart = dilationPoints.find((point) => point.y >= 4);
  const alertLine: ChartPoint[] = activePhaseStart
    ? [
        { x: activePhaseStart.x, y: activePhaseStart.y },
        { x: activePhaseStart.x + (dilationMax - activePhaseStart.y), y: dilationMax },
      ]
    : [];
  const actionLine: ChartPoint[] = activePhaseStart
    ? [
        { x: activePhaseStart.x + 4, y: activePhaseStart.y },
        { x: activePhaseStart.x + 4 + (dilationMax - activePhaseStart.y), y: dilationMax },
      ]
    : [];
  return { alertLine, actionLine };
}

export function computeContractionsPer10Min(
  contractionEvents: { id: string; occurredAt: string }[],
): Map<string, number> {
  const contractionsPer10MinById = new Map<string, number>();
  const trailingWindow: number[] = [];
  for (const event of contractionEvents) {
    const time = new Date(event.occurredAt).getTime();
    trailingWindow.push(time);
    while (trailingWindow.length > 0 && (trailingWindow[0] ?? time) < time - 10 * 60 * 1000) {
      trailingWindow.shift();
    }
    contractionsPer10MinById.set(event.id, trailingWindow.length);
  }
  return contractionsPer10MinById;
}
