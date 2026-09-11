// Pixel coordinates measured from apps/web/src/assets/partograph-template.png (595x841,
// A4 @72dpi) using apps/web/scripts/calibrate-partograph-template.ts, cross-checked by
// rendering a labeled debug overlay and visually confirming every band aligns with the
// printed grid. Re-run the calibration script and re-verify if the template asset is ever
// replaced.

export const TEMPLATE_WIDTH = 595;
export const TEMPLATE_HEIGHT = 841;

export type ContinuousBand = {
  x0: number;
  x1: number;
  yTop: number;
  yBottom: number;
  valueMin: number;
  valueMax: number;
};

export type ColumnBand = {
  columnX: number[];
  yTop: number;
  yBottom: number;
};

// Pixel x-center of each of the 24 hour columns (1-24, left to right) under "hora do
// exame" — shared by every band, since the grid is one continuous table.
const HOUR_COLUMN_X = [
  51, 73, 94, 115, 136, 157, 178, 200, 221, 242, 263, 284, 305, 327, 348, 369, 390, 411, 432, 454,
  475, 496, 517, 538,
];

export const FCF_BAND: ContinuousBand = {
  x0: 51,
  x1: 538,
  yTop: 64,
  yBottom: 150,
  valueMin: 100,
  valueMax: 180,
};

// Dilatação (0-10cm, left axis) and Descida/De Lee (-3..+4, mirrored right axis) share the
// same grid — only valueMin/valueMax differ.
export const DILATION_BAND: ContinuousBand = {
  x0: 51,
  x1: 538,
  yTop: 193,
  yBottom: 408,
  valueMin: 0,
  valueMax: 10,
};

// De Lee's own axis runs the opposite direction from dilatação's on the same physical
// grid: -3 sits near the top of the labelled scale (y≈236) and +4 sits near the bottom
// (y≈387) — descent increases downward. yTop (387) > yBottom (236) here is intentional:
// mapContinuousY maps valueMax (4) to yTop and valueMin (-3) to yBottom, which correctly
// places +4 at y≈387 and -3 at y≈236.
export const STATION_BAND: ContinuousBand = {
  x0: 51,
  x1: 538,
  yTop: 387,
  yBottom: 236,
  valueMin: -3,
  valueMax: 4,
};

export const PULSE_PA_BAND: ContinuousBand = {
  x0: 51,
  x1: 538,
  yTop: 641,
  yBottom: 769,
  valueMin: 60,
  valueMax: 180,
};

export const CONTRACTIONS_BAND: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 457,
  yBottom: 511,
};

// Blank row directly below the dilatação/descida chart's "hora 0, 1, 2...24" relative-hour
// axis, labeled "hora do exame" on the template — meant to hold the real clock hour for
// each column (unlike the axis above it, whose 1-24 labels are relative to t0, not a time
// of day). Re-measured directly from the template: 408 is DILATION_BAND's own yBottom
// (bottom border of the numbered axis row), 450 is the next gridline before CONTRACTIONS_BAND.
export const EXAM_HOUR_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 408,
  yBottom: 450,
};

// Ocitocina has two stacked sub-rows on the template ("U/L" on top, "gotas/min" below) —
// split the same way the three urine sub-rows are, so each value stamps into its own row
// instead of both stacking into the bottom sub-row. Boundaries re-measured directly from
// the template (scoped pixel scan of y=440-510) rather than the original full-height scan,
// which mixed in gridlines from unrelated bands: true split is 511-518 / 518-529, not the
// originally-assumed even 511-520 / 520-529 split.
export const OXYTOCIN_CONCENTRATION_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 521,
  yBottom: 528,
};

export const OXYTOCIN_DRIP_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 528,
  yBottom: 539,
};

export const MEDICATION_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 529,
  yBottom: 632,
};

// Medicamentos are written vertically, one 30-minute slot per column (twice the density
// of every other band's hourly columns) — each hour cell's slot splits into two half-hour
// slots straddling its center.
export const MEDICATION_HALF_HOUR_X: number[] = HOUR_COLUMN_X.flatMap((center) => [
  center - 5.3,
  center + 5.3,
]);

// The template's own printed grid in the L.A./Bolsa row is finer than the 24 hour-tick
// positions (HOUR_COLUMN_X) — 48 columns, ~10.6px apart, one per 30 minutes — measured
// directly off the template the same way as UTERINE_ACTIVITY_* in partograph-overlay-svg.ts
// (prompts/017-partograph/partograma_vs_ok.png and apps/web/src/assets/partograph-template.png,
// both 595x841px). HOUR_COLUMN_X only lines up with every other one of these.
export const LA_BOLSA_COLUMN_X: number[] = [
  51, 61.5, 72.25, 82.75, 93.5, 104, 114.5, 125.25, 135.75, 146.25, 156.75, 167.5, 178.25, 188.75,
  199.25, 209.75, 220.5, 231, 241.5, 252.25, 262.75, 273.25, 283.75, 294.5, 305.25, 315.75, 326.25,
  336.75, 347.5, 358.25, 368.75, 379.25, 389.75, 400.25, 410.75, 421.5, 432.25, 442.75, 453.25,
  463.75, 474.5, 485.25, 495.75, 506.25, 516.75, 527.5, 538.25, 548.75,
];

// L.A. (liquido amniótico) and Bolsa are two stacked sub-rows on the template — split so
// amniotic-fluid events and membrane-rupture events land in their own row instead of
// overlapping in the same cell.
export const LA_ROW: ColumnBand = {
  columnX: LA_BOLSA_COLUMN_X,
  yTop: 150,
  yBottom: 172,
};

export const BOLSA_ROW: ColumnBand = {
  columnX: LA_BOLSA_COLUMN_X,
  yTop: 172,
  yBottom: 193,
};

// Re-measured directly from the template (scoped pixel scan of y=769-814): the temperatura
// row is the single cell band 786-797 — 779 is the blank gap below the pulso/P.A. band's own
// bottom border, and 800 falls between two real gridlines (797 and 803) rather than on one,
// which is why stamped values previously rendered low and to the right of their cell.
export const TEMPERATURE_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 786,
  yBottom: 797,
};

// yTop corrected to 803 — the real gridline (see TEMPERATURE_ROW comment). 797 is the
// temperatura row's own bottom border, with a blank ~6px gap before proteina starts at 803;
// the original 800 sat inside that gap, matching neither boundary.
export const URINE_PROTEIN_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 803,
  yBottom: 814,
};

export const URINE_KETONE_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 814,
  yBottom: 824,
};

export const URINE_VOLUME_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 824,
  yBottom: 836,
};
