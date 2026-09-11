import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import {
  type UterineActivityChartRow,
  computeUterineActivityChartColumns,
} from "@/lib/birth-mode-uterine-activity-chart-utils";
import {
  BOLSA_ROW,
  CONTRACTIONS_BAND,
  EXAM_HOUR_ROW,
  LA_ROW,
} from "@/lib/partograph-template-calibration";
import { describe, expect, it } from "vitest";
import { buildPartographOverlaySvg, columnX } from "./partograph-overlay-svg";

const ROW_HEIGHT = (CONTRACTIONS_BAND.yBottom - CONTRACTIONS_BAND.yTop) / 5;
const CELL_WIDTH = 14;

// Mirrors partograph-overlay-svg.ts's UTERINE_ACTIVITY_* constants — the contractions
// band's own fine 48-cell grid (measured off prompts/017-partograph/partograma_vs_ok.png),
// distinct from the coarser 24-position HOUR_COLUMN_X used by birth_contractions.
const UTERINE_ACTIVITY_FIRST_COLUMN_X = 51;
const UTERINE_ACTIVITY_COLUMN_PITCH = 10.59;
const UTERINE_ACTIVITY_CELL_WIDTH = 9;

let eventCounter = 0;
function makeEvent(
  type: BirthModeTimelineEvent["type"],
  occurredAt: string,
  payload: Record<string, unknown>,
): BirthModeTimelineEvent {
  eventCounter += 1;
  return {
    type,
    id: `event-${eventCounter}`,
    occurredAt,
    professionalId: null,
    professionalName: "Profissional",
    payload,
  };
}

function uterineActivityEvent(
  occurredAt: string,
  intervalMinutes: 10 | 20 | 30,
  durationsSeconds: number[],
) {
  return makeEvent("uterine_activity", occurredAt, {
    interval_minutes: intervalMinutes,
    durations_seconds: durationsSeconds,
  });
}

function contractionEvent(
  occurredAt: string,
  contractionsPer10Min: number | null,
  durationSeconds: number,
) {
  return makeEvent("contraction", occurredAt, {
    contractions_per_10min: contractionsPer10Min,
    duration_seconds: durationSeconds,
  });
}

function amnioticFluidEvent(occurredAt: string, fluidType: string) {
  return makeEvent("amniotic_fluid", occurredAt, { fluid_type: fluidType });
}

function membraneRuptureEvent(occurredAt: string) {
  return makeEvent("membrane_rupture", occurredAt, { rupture_type: "espontanea" });
}

function startMonitoringEvent(occurredAt: string) {
  return makeEvent("start_monitoring", occurredAt, {});
}

function cellX(columnIndex: number): number {
  return columnX(CONTRACTIONS_BAND, columnIndex) - CELL_WIDTH / 2;
}

function fullRect(columnIndex: number, rowIndexFromTop: number): string {
  const x = cellX(columnIndex);
  const y = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
  return `<rect x="${x}" y="${y}" width="${CELL_WIDTH}" height="${ROW_HEIGHT}" fill="#111827" />`;
}

function halfFillRect(columnIndex: number, rowIndexFromTop: number): string {
  const x = cellX(columnIndex);
  const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
  const halfY = cellYTop + ROW_HEIGHT / 2;
  return `<rect x="${x}" y="${halfY}" width="${CELL_WIDTH}" height="${ROW_HEIGHT / 2}" fill="#111827" />`;
}

// uterine_activity columns sit on the band's own fine grid (see UTERINE_ACTIVITY_* above),
// not on HOUR_COLUMN_X/columnX — see partograph-overlay-svg.ts's uterineActivityColumnX.
function uterineColumnX(columnIndex: number): number {
  return UTERINE_ACTIVITY_FIRST_COLUMN_X + columnIndex * UTERINE_ACTIVITY_COLUMN_PITCH;
}

function uterineCellX(columnIndex: number): number {
  return uterineColumnX(columnIndex) - UTERINE_ACTIVITY_CELL_WIDTH / 2;
}

function uterineFullRect(columnIndex: number, rowIndexFromTop: number): string {
  const x = uterineCellX(columnIndex);
  const y = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
  return `<rect x="${x}" y="${y}" width="${UTERINE_ACTIVITY_CELL_WIDTH}" height="${ROW_HEIGHT}" fill="#111827" />`;
}

function uterineTriangleCell(columnIndex: number, rowIndexFromTop: number): string {
  const x = uterineCellX(columnIndex);
  const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
  const points = `${x + UTERINE_ACTIVITY_CELL_WIDTH},${cellYTop} ${x + UTERINE_ACTIVITY_CELL_WIDTH},${cellYTop + ROW_HEIGHT} ${x},${cellYTop + ROW_HEIGHT}`;
  return `<polygon points="${points}" fill="#111827" />`;
}

describe("buildPartographOverlaySvg — uterine_activity band (Phase 1+2)", () => {
  it("draws ⬛/◢ cells matching computeUterineActivityChartColumns for the same events", () => {
    const rows: UterineActivityChartRow[] = [
      { interval_minutes: 10, durations_seconds: [45, 25, 15] },
    ];
    const expectedColumns = computeUterineActivityChartColumns(rows);
    expect(expectedColumns[0]?.cells).toEqual([{ symbol: "⬛" }, { symbol: "◢" }]);

    const svg = buildPartographOverlaySvg([
      uterineActivityEvent("2026-01-01T00:00:00Z", 10, [45, 25, 15]),
    ]);

    // cells[0] (⬛, bottom-most) → row index from top = 4 (last of 5 physical rows)
    expect(svg).toContain(uterineFullRect(0, 4));
    // cells[1] (◢, next up) → row index from top = 3
    expect(svg).toContain(uterineTriangleCell(0, 3));
  });

  it("excludes contractions <20s from the drawn matrix", () => {
    const svg = buildPartographOverlaySvg([
      uterineActivityEvent("2026-01-01T00:00:00Z", 10, [10, 15]),
    ]);

    expect(svg).not.toContain(uterineFullRect(0, 4));
    expect(svg).not.toContain(uterineTriangleCell(0, 4));
  });

  it("takes precedence over birth_contractions when a birth has both event types", () => {
    const svg = buildPartographOverlaySvg([
      contractionEvent("2026-01-01T00:00:00Z", 3, 45),
      uterineActivityEvent("2026-01-01T00:10:00Z", 10, [45]),
    ]);

    // contractionCell's outline never appears when uterine_activity wins the band
    expect(svg).not.toContain('fill="none" stroke="#111827"');
    // uterine_activity's single ⬛ cell (bottom row of its column) is drawn instead
    expect(svg).toContain(uterineFullRect(0, 4));
  });

  it("draws adjacent columns with small, consistent padding — never overlapping and never gapped further than one cell pitch", () => {
    const svg = buildPartographOverlaySvg([
      uterineActivityEvent("2026-01-01T00:00:00Z", 20, [45, 45, 45, 45]),
    ]);

    // 20 min → 2 blocks of 2 durations each, both fully >40s (⬛). Both columns' bottom
    // cell lands on the same row, so parse the two real <rect> x positions at that y
    // straight out of the SVG and confirm the gap between them matches the intended
    // per-side padding (column pitch minus cell width) — not the old 22px-overlap
    // behavior, and not the original unpadded 14px-in-a-21px-pitch gap either.
    const bottomRowY = CONTRACTIONS_BAND.yTop + 4 * ROW_HEIGHT;
    const xs = [
      ...svg.matchAll(new RegExp(`<rect x="([\\d.]+)" y="${bottomRowY}"[^>]*fill="#111827"`, "g")),
    ].map((m) => Number(m[1]));
    expect(xs).toHaveLength(2);
    const [col0X, col1X] = xs.sort((a, b) => a - b) as [number, number];
    const gap = col1X - (col0X + UTERINE_ACTIVITY_CELL_WIDTH);
    expect(gap).toBeCloseTo(UTERINE_ACTIVITY_COLUMN_PITCH - UTERINE_ACTIVITY_CELL_WIDTH, 5);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(UTERINE_ACTIVITY_COLUMN_PITCH);
  });

  it("truncates to the contractions band's 48 fine-grid columns without an out-of-bounds error", () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      uterineActivityEvent(
        `2026-01-${String((i % 28) + 1).padStart(2, "0")}T${String(Math.floor(i / 28)).padStart(2, "0")}:00:00Z`,
        10,
        [45],
      ),
    );

    expect(() => buildPartographOverlaySvg(events)).not.toThrow();

    const svg = buildPartographOverlaySvg(events);
    const cellCount = (svg.match(/fill="#111827"/g) ?? []).length;
    expect(cellCount).toBe(48);
  });
});

const EXAM_HOUR_X_OFFSET = 3;

function examHourText(hourLabel: number, columnIndex: number): string {
  const x = columnX(CONTRACTIONS_BAND, columnIndex) + EXAM_HOUR_X_OFFSET;
  const y = (EXAM_HOUR_ROW.yTop + EXAM_HOUR_ROW.yBottom) / 2 + 3;
  return `<text x="${x}" y="${y}" font-size="8" text-anchor="middle" font-family="Lato">${hourLabel}h</text>`;
}

describe("buildPartographOverlaySvg — hora do exame row", () => {
  it("stamps the São Paulo clock hour into all 24 columns, incrementing by 1 from t0", () => {
    // 2026-01-01T12:42:00Z = 09:42 in São Paulo (UTC-3) → column 0 rounds down to "9h"
    const svg = buildPartographOverlaySvg([uterineActivityEvent("2026-01-01T12:42:00Z", 10, [45])]);

    for (let i = 0; i < 24; i++) {
      expect(svg).toContain(examHourText((9 + i) % 24, i));
    }
  });

  it("wraps past midnight", () => {
    // 2026-01-01T02:15:00Z = 23:15 (previous day) in São Paulo → column 0 = "23h", column 1 = "0h"
    const svg = buildPartographOverlaySvg([uterineActivityEvent("2026-01-01T02:15:00Z", 10, [45])]);

    expect(svg).toContain(examHourText(23, 0));
    expect(svg).toContain(examHourText(0, 1));
  });

  it("is unaffected by which band (contraction vs uterine_activity) is drawn", () => {
    const svg = buildPartographOverlaySvg([contractionEvent("2026-01-01T12:00:00Z", 2, 45)]);
    expect(svg).toContain(examHourText(9, 0));
  });
});

function laText(code: string, columnIndex: number): string {
  const x = LA_ROW.columnX[columnIndex];
  const y = LA_ROW.yBottom - 2;
  return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="middle" font-family="Lato">${code}</text>`;
}

function bolsaText(columnIndex: number): string {
  const x = BOLSA_ROW.columnX[columnIndex];
  const y = BOLSA_ROW.yTop + 7;
  return `<text x="${x}" y="${y}" font-size="5.5" text-anchor="middle" font-family="Lato">R</text>`;
}

describe("buildPartographOverlaySvg — L.A./Bolsa row", () => {
  it("stamps the amniotic fluid code (LC/LM/LS, matching the template's own legend) at the correct 30-min column", () => {
    // t0 itself (0h since t0) → column 0
    const svg = buildPartographOverlaySvg([amnioticFluidEvent("2026-01-01T00:00:00Z", "claro")]);
    expect(svg).toContain(laText("LC", 0));
  });

  it("stamps 'R' for a membrane rupture, at 30-min resolution, regardless of rupture_type", () => {
    const svg = buildPartographOverlaySvg([
      contractionEvent("2026-01-01T00:00:00Z", 2, 45),
      membraneRuptureEvent("2026-01-01T00:30:00Z"), // 30 min after t0 → column 1
    ]);
    expect(svg).toContain(bolsaText(1));
  });

  it("places a rupture recorded before birth-mode activation in the first column (labor considered already underway)", () => {
    const svg = buildPartographOverlaySvg([
      startMonitoringEvent("2026-01-01T02:00:00Z"),
      membraneRuptureEvent("2026-01-01T00:00:00Z"), // 2h before activation — becomes t0 itself
    ]);
    expect(svg).toContain(bolsaText(0));
  });
});

describe("buildPartographOverlaySvg — birth_contractions regression (unchanged path)", () => {
  it("draws the existing frequency/duration grid exactly as before, when there is no uterine_activity data", () => {
    const svg = buildPartographOverlaySvg([contractionEvent("2026-01-01T00:00:00Z", 3, 45)]);

    // frequency 3 → rowIndexFromTop = 5 - 3 = 2; duration 45 (>40) → filled rect
    expect(svg).toContain(fullRect(0, 2));
  });

  it("keeps the known byColumn.set() overwrite behavior unchanged (documented, not fixed — out of PRD scope)", () => {
    const svg = buildPartographOverlaySvg([
      contractionEvent("2026-01-01T00:00:00Z", 2, 45), // same hour column — overwritten
      contractionEvent("2026-01-01T00:10:00Z", 4, 25), // wins (latest reading in that column)
    ]);

    // freq 2 / duration 45 (rowIndexFromTop = 5-2=3, full fill) is lost
    expect(svg).not.toContain(fullRect(0, 3));
    // freq 4 / duration 25 (rowIndexFromTop = 5-4=1, half fill) is what's drawn
    expect(svg).toContain(halfFillRect(0, 1));
  });
});
