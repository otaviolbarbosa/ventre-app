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
  56, 78, 99, 120, 141, 162, 183, 205, 226, 247, 268, 289, 310, 332, 353, 374, 395, 416, 437, 459,
  480, 501, 522, 543,
];

export const FCF_BAND: ContinuousBand = {
  x0: 56,
  x1: 543,
  yTop: 64,
  yBottom: 150,
  valueMin: 100,
  valueMax: 180,
};

// Dilatação (0-10cm, left axis) and Descida/De Lee (-3..+4, mirrored right axis) share the
// same grid — only valueMin/valueMax differ.
export const DILATION_BAND: ContinuousBand = {
  x0: 56,
  x1: 543,
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
  x0: 56,
  x1: 543,
  yTop: 387,
  yBottom: 236,
  valueMin: -3,
  valueMax: 4,
};

export const PULSE_PA_BAND: ContinuousBand = {
  x0: 56,
  x1: 543,
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

// Ocitocina has two stacked sub-rows on the template ("U/L" on top, "gotas/min" below) —
// split the same way the three urine sub-rows are, so each value stamps into its own row
// instead of both stacking into the bottom sub-row. Boundaries re-measured directly from
// the template (scoped pixel scan of y=440-560) rather than the original full-height scan,
// which mixed in gridlines from unrelated bands: true split is 511-518 / 518-529, not the
// originally-assumed even 511-520 / 520-529 split.
export const OXYTOCIN_CONCENTRATION_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 511,
  yBottom: 518,
};

export const OXYTOCIN_DRIP_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 518,
  yBottom: 529,
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

// L.A. (liquido amniótico) and Bolsa are two stacked sub-rows on the template — split so
// amniotic-fluid events and membrane-rupture events land in their own row instead of
// overlapping in the same cell.
export const LA_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 150,
  yBottom: 172,
};

export const BOLSA_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 172,
  yBottom: 193,
};

// yTop re-measured (scoped scan of y=770-841): the true top boundary of the temperatura
// row is 779, not 786 — the original full-height scan mis-assigned it a few px too low,
// which visually reads as "temperature sits below its row".
export const TEMPERATURE_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 779,
  yBottom: 800,
};

export const URINE_PROTEIN_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 800,
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
