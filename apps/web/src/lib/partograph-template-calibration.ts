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

export const STATION_BAND: ContinuousBand = {
  x0: 56,
  x1: 543,
  yTop: 193,
  yBottom: 408,
  valueMin: -3,
  valueMax: 4,
};

export const PULSE_PA_BAND: ContinuousBand = {
  x0: 56,
  x1: 543,
  yTop: 632,
  yBottom: 779,
  valueMin: 60,
  valueMax: 180,
};

export const CONTRACTIONS_BAND: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 451,
  yBottom: 511,
};

export const OXYTOCIN_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 511,
  yBottom: 529,
};

export const MEDICATION_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 529,
  yBottom: 632,
};

export const LA_BOLSA_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 150,
  yBottom: 193,
};

export const TEMPERATURE_ROW: ColumnBand = {
  columnX: HOUR_COLUMN_X,
  yTop: 786,
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
