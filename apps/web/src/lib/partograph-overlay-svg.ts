import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { type ChartPoint, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import { BIRTH_MEDICATION_TYPE_LABELS } from "@/lib/birth-mode-constants";
import {
  type UterineActivityChartCell,
  type UterineActivityChartColumn,
  type UterineActivityChartRow,
  computeUterineActivityChartColumns,
} from "@/lib/birth-mode-uterine-activity-chart-utils";
import {
  BOLSA_ROW,
  CONTRACTIONS_BAND,
  type ColumnBand,
  type ContinuousBand,
  DILATION_BAND,
  EXAM_HOUR_ROW,
  FCF_BAND,
  LA_ROW,
  MEDICATION_HALF_HOUR_X,
  MEDICATION_ROW,
  OXYTOCIN_CONCENTRATION_ROW,
  OXYTOCIN_DRIP_ROW,
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

// Short codes keyed by the raw `fluid_type` DB enum value (birth_amniotic_fluid_type),
// not by first-lettering the localized label — "Claro"/"Com mecônio"/"Com sangue" all
// start with "C", which previously collapsed every fluid type to the same glyph. Matches
// the template's own pre-printed legend abbreviations (L.C/L.M — "Líquido Amniótico
// Claro"/"Meconial") rather than the single-letter R/C/M/S set used for Bolsa.
const AMNIOTIC_FLUID_SHORT_CODES: Record<string, string> = {
  claro: "LC",
  com_meconio: "LM",
  com_sangue: "LS",
  intacto: "I",
};

const FCF_COLOR = "#1d4ed8";
const DILATION_COLOR = "#1d4ed8";
const STATION_COLOR = "#f97316";
const PULSE_COLOR = "#eab308";
const PA_COLOR = "#3b82f6";

export function mapContinuousX(
  band: Pick<ContinuousBand, "x0" | "x1">,
  hoursSinceT0: number,
): number {
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

// Indexes a band's column-x lookup directly by an already-resolved column index (0-23),
// as opposed to columnX which takes raw hoursSinceT0 and rounds it — use this when the
// value in hand is already a column index, to avoid re-running nearestHourColumn on an
// integer (a no-op, but confusing to read).
function columnXByIndex(band: ColumnBand, columnIndex: number): number {
  return band.columnX[columnIndex] ?? band.columnX[0] ?? 0;
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
  return `${x},${apexY} ${x - 9},${apexY + 15} ${x + 9},${apexY + 15}`;
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
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="none" stroke="${STATION_COLOR}" stroke-width="1.4" />`,
    )
    .join("");

  return [dilationLine, dilationTriangles, stationLine, stationCircles].join("");
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
      return paArrowMarks(
        x,
        mapContinuousY(PULSE_PA_BAND, systolic_bp),
        mapContinuousY(PULSE_PA_BAND, diastolic_bp),
      );
    })
    .join("");

  return [pulseLine, pulseDots, paMarks].join("");
}

const CONTRACTION_ROW_HEIGHT = (CONTRACTIONS_BAND.yBottom - CONTRACTIONS_BAND.yTop) / 5;
const CONTRACTION_CELL_WIDTH = 14;

// One cell per hour column, at the row matching that reading's frequency (1-5, template
// rows top-to-bottom are 5,4,3,2,1) — filled full if the contraction was effective (>40s),
// half (bottom half) if borderline (20-40s), or left as an outline only if <20s.
function contractionCell(x: number, cellYTop: number, durationSeconds: number): string {
  const cellX = x - CONTRACTION_CELL_WIDTH / 2;
  const outline = `<rect x="${cellX}" y="${cellYTop}" width="${CONTRACTION_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT}" fill="none" stroke="#111827" stroke-width="0.6" />`;
  if (durationSeconds > 40) {
    return `<rect x="${cellX}" y="${cellYTop}" width="${CONTRACTION_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT}" fill="#111827" />`;
  }
  if (durationSeconds >= 20) {
    const halfY = cellYTop + CONTRACTION_ROW_HEIGHT / 2;
    return `${outline}<rect x="${cellX}" y="${halfY}" width="${CONTRACTION_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT / 2}" fill="#111827" />`;
  }
  return outline;
}

function buildContractionsElements(events: BirthModeTimelineEvent[]): string {
  const contractionEvents = events
    .filter((event) => event.type === "contraction")
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  if (contractionEvents.length === 0) return "";

  // The contractions band counts its own columns starting from the first contraction
  // ever recorded, not the shared chart t0 (which may be the birth-mode activation time,
  // well before labor's active contractions began).
  const localT0 = new Date(contractionEvents[0]?.occurredAt ?? 0).getTime();

  // One cell per hour column — keep the latest reading recorded within that column.
  const byColumn = new Map<number, { frequency: number; duration: number }>();
  for (const event of contractionEvents) {
    const hoursSinceLocal = (new Date(event.occurredAt).getTime() - localT0) / (1000 * 60 * 60);
    const column = nearestHourColumn(hoursSinceLocal);
    const { contractions_per_10min, duration_seconds } = event.payload as {
      contractions_per_10min: number | null;
      duration_seconds: number;
    };
    byColumn.set(column, {
      frequency: contractions_per_10min ?? 1,
      // duration_seconds is NOT NULL in birth_contractions — no fallback needed.
      duration: duration_seconds,
    });
  }

  return Array.from(byColumn.entries())
    .map(([column, { frequency, duration }]) => {
      const clampedFrequency = Math.max(1, Math.min(5, Math.round(frequency)));
      const rowIndexFromTop = 5 - clampedFrequency;
      const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * CONTRACTION_ROW_HEIGHT;
      const x = columnXByIndex(CONTRACTIONS_BAND, column);
      return contractionCell(x, cellYTop, duration);
    })
    .join("");
}

// Decomposes/classifies `uterine_activity` events into the same column/cell structure
// the on-screen chart produces (computeUterineActivityChartColumns), so the PDF drawing
// step (added separately) never diverges from what the team already sees on screen.
// Not yet wired into buildPartographOverlaySvg — that connection is a separate change.
function buildUterineActivityColumns(
  events: BirthModeTimelineEvent[],
): UterineActivityChartColumn[] {
  const uterineActivityEvents = events
    .filter((event) => event.type === "uterine_activity")
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  if (uterineActivityEvents.length === 0) return [];

  const rows: UterineActivityChartRow[] = uterineActivityEvents.map((event) => {
    const { interval_minutes, durations_seconds } = event.payload as {
      interval_minutes: 10 | 20 | 30;
      durations_seconds: number[];
    };
    return { interval_minutes, durations_seconds };
  });

  return computeUterineActivityChartColumns(rows);
}

// The contractions band's printed grid is FINER than the 24 hour-tick positions
// (HOUR_COLUMN_X) used by every other band — measured directly off the blank template
// (prompts/017-partograph/partograma_vs_ok.png, same 595x841 canvas as TEMPLATE_WIDTH/
// HEIGHT): 48 columns from x=51 (first cell center, coincides with HOUR_COLUMN_X[0]) to
// x=548.75, ~10.59px apart — HOUR_COLUMN_X only lines up with every OTHER one of these.
// buildContractionsElements intentionally keeps using the coarser HOUR_COLUMN_X (one
// isolated cell per column, real exam hour) — untouched. uterine_activity's sequential,
// densely-stacked matrix needs the actual fine grid so cells (a) sit inside their own
// printed cell instead of straddling two, and (b) still read as one contiguous block.
const UTERINE_ACTIVITY_COLUMN_COUNT = 48;
const UTERINE_ACTIVITY_FIRST_COLUMN_X = 51;
const UTERINE_ACTIVITY_COLUMN_PITCH = 10.59;
// Slightly narrower than the ~10.59px cell pitch — small but visible padding on each
// side, without overflowing into the neighboring printed cell.
const UTERINE_ACTIVITY_CELL_WIDTH = 9;

function uterineActivityColumnX(columnIndex: number): number {
  return UTERINE_ACTIVITY_FIRST_COLUMN_X + columnIndex * UTERINE_ACTIVITY_COLUMN_PITCH;
}

// Draws one ◢/⬛ cell for the uterine_activity matrix — polygon/rect only (no Unicode
// glyph text), matching the technique already used for the dilation triangle
// (triangleApexPoints), since glyph rendering via the sharp SVG->PNG pipeline is
// unreliable for arbitrary Unicode symbols.
function uterineActivityCell(
  x: number,
  cellYTop: number,
  symbol: UterineActivityChartCell["symbol"],
): string {
  const cellX = x - UTERINE_ACTIVITY_CELL_WIDTH / 2;
  if (symbol === "⬛") {
    return `<rect x="${cellX}" y="${cellYTop}" width="${UTERINE_ACTIVITY_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT}" fill="#111827" />`;
  }
  const points = `${cellX + UTERINE_ACTIVITY_CELL_WIDTH},${cellYTop} ${cellX + UTERINE_ACTIVITY_CELL_WIDTH},${cellYTop + CONTRACTION_ROW_HEIGHT} ${cellX},${cellYTop + CONTRACTION_ROW_HEIGHT}`;
  return `<polygon points="${points}" fill="#111827" />`;
}

const UTERINE_ACTIVITY_MAX_ROWS = 5; // physical print limit — vs 6 on the interactive screen chart

// Draws the uterine_activity matrix: one column per 10-min registration block
// (chronological order of registration, not real exam hour), positioned on the
// contractions band's own fine 48-cell grid (see UTERINE_ACTIVITY_COLUMN_* above, not
// buildContractionsElements' coarser HOUR_COLUMN_X). Truncates at 48 columns (the
// template's physical limit for this band) and at 5 cells per column (vs 6 on screen).
function buildUterineActivityElements(columns: UterineActivityChartColumn[]): string {
  const truncatedColumns = columns.slice(0, UTERINE_ACTIVITY_COLUMN_COUNT);

  return truncatedColumns
    .map((column, columnIndex) => {
      const x = uterineActivityColumnX(columnIndex);
      return column.cells
        .slice(0, UTERINE_ACTIVITY_MAX_ROWS)
        .map((cell, rowIndexFromBottom) => {
          const rowIndexFromTop = UTERINE_ACTIVITY_MAX_ROWS - 1 - rowIndexFromBottom;
          const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * CONTRACTION_ROW_HEIGHT;
          return uterineActivityCell(x, cellYTop, cell.symbol);
        })
        .join("");
    })
    .join("");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${escapeXmlText(line)}</text>`;
    })
    .join("");
}

// Groups items by hour column first, then stamps each column once with all of that
// column's lines — so multiple events landing in the same hour stack (via
// stampColumnText's own multi-line handling) instead of being drawn on top of each other.
function stampGroupedByColumn(
  band: ColumnBand,
  entries: { hoursSinceT0: number; line: string }[],
): string {
  const byColumn = new Map<number, string[]>();
  for (const { hoursSinceT0, line } of entries) {
    const column = nearestHourColumn(hoursSinceT0);
    const lines = byColumn.get(column) ?? [];
    lines.push(line);
    byColumn.set(column, lines);
  }
  return Array.from(byColumn.entries())
    .map(([column, lines]) => stampColumnText(band, column, lines))
    .join("");
}

function buildOxytocinElements(events: BirthModeTimelineEvent[], t0: number): string {
  const oxytocinEvents = events.filter(
    (event) =>
      event.type === "medication" &&
      (event.payload as { medication_type: string }).medication_type === "ocitocina",
  );

  const concentration = stampGroupedByColumn(
    OXYTOCIN_CONCENTRATION_ROW,
    oxytocinEvents
      .map((event) => {
        const { oxytocin_concentration_u_per_l } = event.payload as {
          oxytocin_concentration_u_per_l: number | null;
        };
        if (oxytocin_concentration_u_per_l == null) return null;
        return {
          hoursSinceT0: hoursSince(t0, event.occurredAt),
          line: `${oxytocin_concentration_u_per_l}`,
        };
      })
      .filter((entry): entry is { hoursSinceT0: number; line: string } => entry != null),
  );

  const drip = stampGroupedByColumn(
    OXYTOCIN_DRIP_ROW,
    oxytocinEvents
      .map((event) => {
        const { oxytocin_drip_rate_gtt_per_min } = event.payload as {
          oxytocin_drip_rate_gtt_per_min: number | null;
        };
        if (oxytocin_drip_rate_gtt_per_min == null) return null;
        return {
          hoursSinceT0: hoursSince(t0, event.occurredAt),
          line: `${oxytocin_drip_rate_gtt_per_min}`,
        };
      })
      .filter((entry): entry is { hoursSinceT0: number; line: string } => entry != null),
  );

  return concentration + drip;
}

// Medicamentos and L.A./Bolsa get their own half-hour-resolution column index (0-47),
// independent of the hourly nearestHourColumn used by every other band. Clamping to 0
// (via Math.max) means an event timestamped before t0 lands in the first column — i.e.
// labor is already considered to have started with that event, not silently dropped.
function nearestHalfHourColumn(hoursSinceT0: number): number {
  return Math.max(0, Math.min(47, Math.round(hoursSinceT0 * 2)));
}

// Same as stampGroupedByColumn/stampColumnText but at half-hour resolution — kept as a
// separate pair of functions (not a shared resolver parameter) so the widely-reused hourly
// helpers stay untouched for every other band still using them.
// baselineY: LA_ROW/BOLSA_ROW each print as TWO stacked sub-rows on the template (a real
// internal gridline splits each label's box in half — see LA_BOLSA_COLUMN_X), so callers
// pick their own vertical anchor per band rather than this function assuming one (L.A.
// keeps the original bottom-anchored position; Bolsa needed to move up off its own row's
// bottom border — see buildLaBolsaElements).
function stampGroupedByHalfHourColumn(
  band: ColumnBand,
  entries: { hoursSinceT0: number; line: string }[],
  baselineY: number,
): string {
  const byColumn = new Map<number, string[]>();
  for (const { hoursSinceT0, line } of entries) {
    const column = nearestHalfHourColumn(hoursSinceT0);
    const lines = byColumn.get(column) ?? [];
    lines.push(line);
    byColumn.set(column, lines);
  }
  return Array.from(byColumn.entries())
    .map(([column, lines]) => {
      const x = band.columnX[column] ?? band.columnX[0] ?? 0;
      return lines
        .map((line, index) => {
          const y = baselineY - index * 6;
          return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${escapeXmlText(line)}</text>`;
        })
        .join("");
    })
    .join("");
}

function buildMedicationElements(events: BirthModeTimelineEvent[], t0: number): string {
  const entries = events
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
      return { column: nearestHalfHourColumn(hoursSince(t0, event.occurredAt)), label };
    });

  const byColumn = new Map<number, string[]>();
  for (const { column, label } of entries) {
    const labels = byColumn.get(column) ?? [];
    labels.push(label);
    byColumn.set(column, labels);
  }

  return Array.from(byColumn.entries())
    .map(([column, labels]) => {
      const x = MEDICATION_HALF_HOUR_X[column] ?? MEDICATION_HALF_HOUR_X[0] ?? 0;
      const y = MEDICATION_ROW.yBottom - 4;
      const text = labels.join(" / ");
      // Vertical text reading bottom-to-top within the slot, anchored near the row's
      // bottom edge so it grows upward into the tall blank medicamentos block.
      return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="start" font-family="Helvetica, Arial, sans-serif" transform="rotate(-90 ${x} ${y})">${escapeXmlText(text)}</text>`;
    })
    .join("");
}

// 30-min resolution (see LA_BOLSA_COLUMN_X) — a rupture or amniotic-fluid reading
// timestamped before birth-mode's own t0 clamps into column 0 (nearestHalfHourColumn),
// meaning labor is considered already underway at that event rather than losing it.
function buildLaBolsaElements(events: BirthModeTimelineEvent[], t0: number): string {
  // L.A.'s own original bottom-anchored position — unchanged from before this feature.
  const amnioticFluid = stampGroupedByHalfHourColumn(
    LA_ROW,
    events
      .filter((event) => event.type === "amniotic_fluid")
      .map((event) => {
        const { fluid_type } = event.payload as { fluid_type: string };
        const code = AMNIOTIC_FLUID_SHORT_CODES[fluid_type] ?? fluid_type.charAt(0).toUpperCase();
        return { hoursSinceT0: hoursSince(t0, event.occurredAt), line: code };
      }),
    LA_ROW.yBottom - 2,
  );

  // "R" (Bolsa rota) regardless of rupture_type (espontânea/artificial) — the template's
  // legend only distinguishes R/C/M/S, not how the rupture happened. Raised off the row's
  // own bottom border (which sits flush against the dilation chart below it) — anchored
  // near BOLSA_ROW's top instead of its bottom or center.
  const ruptures = stampGroupedByHalfHourColumn(
    BOLSA_ROW,
    events
      .filter((event) => event.type === "membrane_rupture")
      .map((event) => ({ hoursSinceT0: hoursSince(t0, event.occurredAt), line: "R" })),
    BOLSA_ROW.yTop + 7,
  );

  return amnioticFluid + ruptures;
}

function buildTemperatureElements(events: BirthModeTimelineEvent[], t0: number): string {
  const entries = events
    .filter((event) => event.type === "maternal_vitals")
    .map((event) => {
      const { temperature_celsius } = event.payload as { temperature_celsius: number | null };
      if (temperature_celsius == null) return null;
      return { hoursSinceT0: hoursSince(t0, event.occurredAt), line: `${temperature_celsius}` };
    })
    .filter((entry): entry is { hoursSinceT0: number; line: string } => entry != null);

  return stampGroupedByColumn(TEMPERATURE_ROW, entries);
}

function buildUrineElements(events: BirthModeTimelineEvent[], t0: number): string {
  const urineEvents = events.filter((event) => event.type === "urine_test");

  const toEntries = (key: "protein_level" | "ketone_level") =>
    urineEvents
      .map((event) => {
        const value = (event.payload as Record<string, string | null>)[key];
        if (value == null) return null;
        return {
          hoursSinceT0: hoursSince(t0, event.occurredAt),
          line: DIPSTICK_SHORT_LABELS[value] ?? value,
        };
      })
      .filter((entry): entry is { hoursSinceT0: number; line: string } => entry != null);

  const volumeEntries = urineEvents
    .map((event) => {
      const { volume_ml } = event.payload as { volume_ml: number | null };
      if (volume_ml == null) return null;
      return { hoursSinceT0: hoursSince(t0, event.occurredAt), line: `${volume_ml}` };
    })
    .filter((entry): entry is { hoursSinceT0: number; line: string } => entry != null);

  const protein = stampGroupedByColumn(URINE_PROTEIN_ROW, toEntries("protein_level"));
  const ketone = stampGroupedByColumn(URINE_KETONE_ROW, toEntries("ketone_level"));
  const volume = stampGroupedByColumn(URINE_VOLUME_ROW, volumeEntries);

  return protein + ketone + volume;
}

// Brazil has no DST since 2019 — a fixed UTC-3 offset round-trips exactly with
// combineDateAndTime's hardcoded "-03:00" used when saving birth-event times
// (birth-mode-duplicate-check.ts), regardless of the server process's own timezone.
const SAO_PAULO_UTC_OFFSET_HOURS = -3;

function saoPauloHour(epochMs: number): number {
  return (new Date(epochMs).getUTCHours() + SAO_PAULO_UTC_OFFSET_HOURS + 24) % 24;
}

// Stamps the real clock hour (São Paulo local time) into every one of the 24 "hora do
// exame" cells, directly below the chart's relative "hora 0, 1, 2...24" axis — column N
// always shows t0's hour + N, wrapping past midnight, independent of whether that column
// has any recorded event (it's a translation of the relative axis, not event-driven data).
// Small rightward nudge so the "Nh" label sits visually centered in its cell — despite
// text-anchor="middle", the rendered glyphs read slightly left-of-center at this column
// pitch (confirmed against the printed template), so this compensates by eye.
const EXAM_HOUR_X_OFFSET = 3;

function buildExamHourElements(t0: number): string {
  const startHour = saoPauloHour(t0);
  // Vertically centered in the row (yTop/yBottom midpoint), with a small baseline
  // offset since SVG "y" positions the text baseline, not its visual center.
  const y = (EXAM_HOUR_ROW.yTop + EXAM_HOUR_ROW.yBottom) / 2 + 3;
  return EXAM_HOUR_ROW.columnX
    .map((x, columnIndex) => {
      const hourLabel = (startHour + columnIndex) % 24;
      return `<text x="${x + EXAM_HOUR_X_OFFSET}" y="${y}" font-size="8" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${hourLabel}h</text>`;
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
  const uterineActivityColumns = buildUterineActivityColumns(events);
  const contractions =
    uterineActivityColumns.length > 0
      ? buildUterineActivityElements(uterineActivityColumns)
      : buildContractionsElements(events);
  const examHour = buildExamHourElements(t0);
  const columnText = buildColumnTextBands(events, t0);

  return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${fcf}${dilationStation}${pulsePa}${contractions}${examHour}${columnText}</svg>`;
}
