import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import {
  type ColumnBand,
  type ContinuousBand,
  FCF_BAND,
  TEMPLATE_HEIGHT,
  TEMPLATE_WIDTH,
} from "@/lib/partograph-template-calibration";

const FCF_COLOR = "#1d4ed8";

export function mapContinuousX(band: Pick<ContinuousBand, "x0" | "x1">, hoursSinceT0: number): number {
  const clamped = Math.max(0, Math.min(23, hoursSinceT0));
  return band.x0 + (clamped / 23) * (band.x1 - band.x0);
}

export function mapContinuousY(
  band: Pick<ContinuousBand, "yTop" | "yBottom" | "valueMin" | "valueMax">,
  value: number,
): number {
  const clamped = Math.max(band.valueMin, Math.min(band.valueMax, value));
  const ratio = (band.valueMax - clamped) / (band.valueMax - band.valueMin);
  return band.yTop + ratio * (band.yBottom - band.yTop);
}

export function nearestHourColumn(hoursSinceT0: number): number {
  return Math.max(0, Math.min(23, Math.round(hoursSinceT0)));
}

export function columnX(band: ColumnBand, hoursSinceT0: number): number {
  return band.columnX[nearestHourColumn(hoursSinceT0)] ?? band.columnX[0] ?? 0;
}

function buildFcfElements(events: BirthModeTimelineEvent[], t0: number): string {
  const points = events
    .filter((event) => event.type === "fetal_heart_rate")
    .map((event) => ({
      x: mapContinuousX(FCF_BAND, hoursSince(t0, event.occurredAt)),
      y: mapContinuousY(FCF_BAND, (event.payload as { bpm: number }).bpm),
    }))
    .sort((a, b) => a.x - b.x);

  if (points.length === 0) return "";

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const dots = points
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="1.6" fill="${FCF_COLOR}" />`)
    .join("");

  return `<polyline points="${polylinePoints}" fill="none" stroke="${FCF_COLOR}" stroke-width="1.1" />${dots}`;
}

export function buildPartographOverlaySvg(events: BirthModeTimelineEvent[]): string {
  const t0 = resolveChartT0(events);
  if (t0 === null) {
    return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }

  const fcf = buildFcfElements(events, t0);

  return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${fcf}</svg>`;
}
