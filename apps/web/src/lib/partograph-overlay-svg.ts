import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { computeAlertActionLines, type ChartPoint, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_MEDICATION_TYPE_LABELS,
  BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS,
} from "@/lib/birth-mode-constants";
import {
  type ColumnBand,
  type ContinuousBand,
  CONTRACTIONS_BAND,
  DILATION_BAND,
  FCF_BAND,
  LA_BOLSA_ROW,
  MEDICATION_ROW,
  OXYTOCIN_ROW,
  PULSE_PA_BAND,
  STATION_BAND,
  TEMPERATURE_ROW,
  TEMPLATE_HEIGHT,
  TEMPLATE_WIDTH,
  URINE_KETONE_ROW,
  URINE_PROTEIN_ROW,
  URINE_VOLUME_ROW,
} from "@/lib/partograph-template-calibration";

const DIPSTICK_SHORT_LABELS: Record<string, string> = {
  ausente: "-",
  tracos: "tr",
  uma_cruz: "+",
  duas_cruzes: "++",
  tres_cruzes: "+++",
};

const FCF_COLOR = "#1d4ed8";
const DILATION_COLOR = "#1d4ed8";
const STATION_COLOR = "#f97316";
const ALERT_COLOR = "#eab308";
const ACTION_COLOR = "#ef4444";
const PULSE_COLOR = "#eab308";
const PA_COLOR = "#3b82f6";

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

function triangleApexPoints(x: number, apexY: number): string {
  // Apex (top vertex) sits exactly at (x, apexY) per explicit product requirement —
  // the base is drawn below it, never centered on the point.
  return `${x},${apexY} ${x - 4},${apexY + 7} ${x + 4},${apexY + 7}`;
}

function buildDilationStationElements(events: BirthModeTimelineEvent[], t0: number): string {
  const dilationPoints: ChartPoint[] = events
    .filter((event) => event.type === "cervical_dilation")
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { dilation_cm: number }).dilation_cm,
    }))
    .sort((a, b) => a.x - b.x);

  const stationPoints: ChartPoint[] = events
    .filter((event) => event.type === "fetal_station")
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { station_lee: number }).station_lee,
    }))
    .sort((a, b) => a.x - b.x);

  const { alertLine, actionLine } = computeAlertActionLines(dilationPoints, 10);

  const dilationPixels = dilationPoints.map((p) => ({
    x: mapContinuousX(DILATION_BAND, p.x),
    y: mapContinuousY(DILATION_BAND, p.y),
  }));
  const dilationLine =
    dilationPixels.length > 0
      ? `<polyline points="${dilationPixels.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${DILATION_COLOR}" stroke-width="1.1" />`
      : "";
  const dilationTriangles = dilationPixels
    .map((p) => `<polygon points="${triangleApexPoints(p.x, p.y)}" fill="${DILATION_COLOR}" />`)
    .join("");

  const stationPixels = stationPoints.map((p) => ({
    x: mapContinuousX(STATION_BAND, p.x),
    y: mapContinuousY(STATION_BAND, p.y),
  }));
  const stationLine =
    stationPixels.length > 0
      ? `<polyline points="${stationPixels.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${STATION_COLOR}" stroke-width="1" stroke-dasharray="3 2" />`
      : "";
  const stationCircles = stationPixels
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.2" fill="none" stroke="${STATION_COLOR}" stroke-width="1" />`)
    .join("");

  const toLine = (points: ChartPoint[], color: string) => {
    if (points.length === 0) return "";
    const pixels = points.map((p) => `${mapContinuousX(DILATION_BAND, p.x)},${mapContinuousY(DILATION_BAND, p.y)}`);
    return `<polyline points="${pixels.join(" ")}" fill="none" stroke="${color}" stroke-width="0.75" stroke-dasharray="3 2" />`;
  };

  return [
    dilationLine,
    dilationTriangles,
    stationLine,
    stationCircles,
    toLine(alertLine, ALERT_COLOR),
    toLine(actionLine, ACTION_COLOR),
  ].join("");
}

function paArrowMarks(x: number, systolicY: number, diastolicY: number): string {
  const cap = 3;
  return [
    `<line x1="${x}" y1="${systolicY}" x2="${x}" y2="${diastolicY}" stroke="${PA_COLOR}" stroke-width="1" />`,
    `<polygon points="${x},${systolicY} ${x - cap},${systolicY + cap} ${x + cap},${systolicY + cap}" fill="${PA_COLOR}" />`,
    `<polygon points="${x},${diastolicY} ${x - cap},${diastolicY - cap} ${x + cap},${diastolicY - cap}" fill="${PA_COLOR}" />`,
  ].join("");
}

function buildPulsePaElements(events: BirthModeTimelineEvent[], t0: number): string {
  const vitalsEvents = events.filter((event) => event.type === "maternal_vitals");

  const pulsePixels = vitalsEvents
    .map((event) => {
      const { pulse_bpm } = event.payload as { pulse_bpm: number | null };
      if (pulse_bpm == null) return null;
      return {
        x: mapContinuousX(PULSE_PA_BAND, hoursSince(t0, event.occurredAt)),
        y: mapContinuousY(PULSE_PA_BAND, pulse_bpm),
      };
    })
    .filter((p): p is { x: number; y: number } => p != null)
    .sort((a, b) => a.x - b.x);

  const pulseLine =
    pulsePixels.length > 0
      ? `<polyline points="${pulsePixels.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${PULSE_COLOR}" stroke-width="1" />`
      : "";
  const pulseDots = pulsePixels
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="1.6" fill="${PULSE_COLOR}" />`)
    .join("");

  const paMarks = vitalsEvents
    .map((event) => {
      const { systolic_bp, diastolic_bp } = event.payload as {
        systolic_bp: number | null;
        diastolic_bp: number | null;
      };
      if (systolic_bp == null || diastolic_bp == null) return "";
      const x = mapContinuousX(PULSE_PA_BAND, hoursSince(t0, event.occurredAt));
      return paArrowMarks(x, mapContinuousY(PULSE_PA_BAND, systolic_bp), mapContinuousY(PULSE_PA_BAND, diastolic_bp));
    })
    .join("");

  return [pulseLine, pulseDots, paMarks].join("");
}

const CONTRACTION_PATTERN_DEFS = `
  <defs>
    <pattern id="contraction-dots" width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.6" fill="#111827" />
    </pattern>
    <pattern id="contraction-diag" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="4" stroke="#111827" stroke-width="1.2" />
    </pattern>
  </defs>
`;

function contractionFill(durationSeconds: number | null): string {
  if (durationSeconds == null) return "url(#contraction-dots)";
  if (durationSeconds < 20) return "url(#contraction-dots)";
  if (durationSeconds <= 40) return "url(#contraction-diag)";
  return "#111827";
}

function buildContractionsElements(events: BirthModeTimelineEvent[], t0: number): string {
  const contractionEvents = events.filter((event) => event.type === "contraction");
  // One bar per hour column — keep the latest reading recorded within that column.
  const byColumn = new Map<number, { frequency: number; duration: number | null }>();
  for (const event of contractionEvents) {
    const column = nearestHourColumn(hoursSince(t0, event.occurredAt));
    const { contractions_per_10min, duration_seconds } = event.payload as {
      contractions_per_10min: number | null;
      duration_seconds: number;
    };
    byColumn.set(column, {
      frequency: contractions_per_10min ?? 0,
      duration: duration_seconds ?? null,
    });
  }

  const barWidth = 6;
  const bars = Array.from(byColumn.entries())
    .map(([column, { frequency, duration }]) => {
      const x = columnX(CONTRACTIONS_BAND, column) - barWidth / 2;
      const clampedFrequency = Math.max(0, Math.min(5, frequency));
      const barHeight = (clampedFrequency / 5) * (CONTRACTIONS_BAND.yBottom - CONTRACTIONS_BAND.yTop);
      const y = CONTRACTIONS_BAND.yBottom - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${contractionFill(duration)}" />`;
    })
    .join("");

  return bars.length > 0 ? `${CONTRACTION_PATTERN_DEFS}${bars}` : "";
}

// Stacks 1+ lines of text centered on an hour column, growing upward from the row's
// bottom gridline — used for every band that's a blank text row on the template rather
// than a numeric-scale grid (Ocitocina, Medicamentos, L.A./Bolsa, Temperatura, Urina).
function stampColumnText(band: ColumnBand, hoursSinceT0: number, lines: string[]): string {
  if (lines.length === 0) return "";
  const x = columnX(band, hoursSinceT0);
  const lineHeight = 6;
  return lines
    .map((line, index) => {
      const y = band.yBottom - index * lineHeight - 2;
      return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="middle">${line}</text>`;
    })
    .join("");
}

function buildOxytocinElements(events: BirthModeTimelineEvent[], t0: number): string {
  return events
    .filter(
      (event) =>
        event.type === "medication" &&
        (event.payload as { medication_type: string }).medication_type === "ocitocina",
    )
    .map((event) => {
      const { oxytocin_concentration_u_per_l, oxytocin_drip_rate_gtt_per_min } = event.payload as {
        oxytocin_concentration_u_per_l: number | null;
        oxytocin_drip_rate_gtt_per_min: number | null;
      };
      const lines = [
        oxytocin_concentration_u_per_l != null ? `${oxytocin_concentration_u_per_l}U/L` : null,
        oxytocin_drip_rate_gtt_per_min != null ? `${oxytocin_drip_rate_gtt_per_min}gtt` : null,
      ].filter((line): line is string => line != null);
      return stampColumnText(OXYTOCIN_ROW, hoursSince(t0, event.occurredAt), lines);
    })
    .join("");
}

function buildMedicationElements(events: BirthModeTimelineEvent[], t0: number): string {
  return events
    .filter(
      (event) =>
        event.type === "medication" &&
        (event.payload as { medication_type: string }).medication_type !== "ocitocina",
    )
    .map((event) => {
      const { medication_type, other_birth_medication_type } = event.payload as {
        medication_type: string;
        other_birth_medication_type: string | null;
      };
      const label =
        medication_type === "outros" && other_birth_medication_type
          ? other_birth_medication_type
          : (BIRTH_MEDICATION_TYPE_LABELS[medication_type] ?? medication_type);
      return stampColumnText(MEDICATION_ROW, hoursSince(t0, event.occurredAt), [label]);
    })
    .join("");
}

function buildLaBolsaElements(events: BirthModeTimelineEvent[], t0: number): string {
  const amnioticFluid = events
    .filter((event) => event.type === "amniotic_fluid")
    .map((event) => {
      const { fluid_type } = event.payload as { fluid_type: string };
      const label = AMNIOTIC_FLUID_TYPE_LABELS[fluid_type] ?? fluid_type;
      return stampColumnText(LA_BOLSA_ROW, hoursSince(t0, event.occurredAt), [label.charAt(0).toUpperCase()]);
    })
    .join("");

  const ruptures = events
    .filter((event) => event.type === "membrane_rupture")
    .map((event) => {
      const { rupture_type } = event.payload as { rupture_type: string };
      const label = BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS[rupture_type] ?? rupture_type;
      return stampColumnText(LA_BOLSA_ROW, hoursSince(t0, event.occurredAt), [`Bolsa: ${label.charAt(0)}`]);
    })
    .join("");

  return amnioticFluid + ruptures;
}

function buildTemperatureElements(events: BirthModeTimelineEvent[], t0: number): string {
  return events
    .filter((event) => event.type === "maternal_vitals")
    .map((event) => {
      const { temperature_celsius } = event.payload as { temperature_celsius: number | null };
      if (temperature_celsius == null) return "";
      return stampColumnText(TEMPERATURE_ROW, hoursSince(t0, event.occurredAt), [`${temperature_celsius}`]);
    })
    .join("");
}

function buildUrineElements(events: BirthModeTimelineEvent[], t0: number): string {
  return events
    .filter((event) => event.type === "urine_test")
    .map((event) => {
      const { protein_level, ketone_level, volume_ml } = event.payload as {
        protein_level: string | null;
        ketone_level: string | null;
        volume_ml: number | null;
      };
      const hours = hoursSince(t0, event.occurredAt);
      const protein =
        protein_level != null
          ? stampColumnText(URINE_PROTEIN_ROW, hours, [DIPSTICK_SHORT_LABELS[protein_level] ?? protein_level])
          : "";
      const ketone =
        ketone_level != null
          ? stampColumnText(URINE_KETONE_ROW, hours, [DIPSTICK_SHORT_LABELS[ketone_level] ?? ketone_level])
          : "";
      const volume =
        volume_ml != null ? stampColumnText(URINE_VOLUME_ROW, hours, [`${volume_ml}`]) : "";
      return protein + ketone + volume;
    })
    .join("");
}

function buildColumnTextBands(events: BirthModeTimelineEvent[], t0: number): string {
  return [
    buildOxytocinElements(events, t0),
    buildMedicationElements(events, t0),
    buildLaBolsaElements(events, t0),
    buildTemperatureElements(events, t0),
    buildUrineElements(events, t0),
  ].join("");
}

export function buildPartographOverlaySvg(events: BirthModeTimelineEvent[]): string {
  const t0 = resolveChartT0(events);
  if (t0 === null) {
    return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }

  const fcf = buildFcfElements(events, t0);
  const dilationStation = buildDilationStationElements(events, t0);
  const pulsePa = buildPulsePaElements(events, t0);
  const contractions = buildContractionsElements(events, t0);
  const columnText = buildColumnTextBands(events, t0);

  return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${fcf}${dilationStation}${pulsePa}${contractions}${columnText}</svg>`;
}
