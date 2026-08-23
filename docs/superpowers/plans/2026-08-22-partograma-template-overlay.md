# Partograma: overlay sobre template oficial + storage + PDF com cabeçalho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the from-scratch SVG bands in the partograma PDF with a data overlay plotted precisely on top of the official MS partograma template image, save the composed image to Supabase Storage per pregnancy, and add a Ventre-branded header to the PDF.

**Architecture:** A calibration module maps template pixel coordinates to data bands. An SVG-overlay module builds one 595×841 SVG per export using that calibration. `sharp` flattens the SVG onto the template PNG into a single buffer, which is uploaded to Storage and also embedded directly into the `@react-pdf/renderer` PDF, below a new header block.

**Tech Stack:** `sharp` (new dependency, server-only), `@react-pdf/renderer` (existing), Supabase Storage, existing `birth-mode-chart-utils.ts` helpers (`resolveChartT0`, `hoursSince`, `computeAlertActionLines`, `computeContractionsPer10Min`).

**Spec:** `docs/superpowers/specs/2026-08-22-partograma-template-overlay-design.md`

## Global Constraints

- All user-facing strings in pt-BR (existing project convention).
- Server-only modules (`partograph-image.ts`, `partograph-overlay-svg.ts`, `partograph-storage.ts`, `partograph-header-data.ts`, `partograph-pdf.ts`) must never be imported from client components — same convention as the existing `contract-pdf.ts`/`partograph-pdf.ts` files (see their header comments).
- **No test runner exists in this repo** (`grep` for `vitest`/`jest`/`"test"` in `package.json` returns nothing, and no `*.test.ts` files exist). Verification for every task is: a small throwaway script under the session scratchpad, run with `npx tsx <script>.ts`, whose output (PNG/PDF/console values) you inspect manually. This matches how the existing `contract-pdf.ts`/`partograph-pdf.ts` code is verified today (no automated tests).
- Dilatação triangles: the **apex (top vertex)**, not the shape's centroid, must sit exactly at the plotted coordinate. Confirmed explicitly by the user — do not center the triangle on the point.
- `uploadPartographImage` uses `supabaseAdmin` for the Storage write. This is safe without an extra authorization check because the caller (`export-partograph-pdf-action.ts`) already fetched the pregnancy's data through `ctx.supabase` (anon key, RLS-scoped) earlier in the same action — if the user isn't a team member, that fetch already throws before the admin upload is ever reached. Do not add a redundant membership check.
- Column-based bands (see Task 8) align data to whole hour columns (`Math.round(hoursSinceT0)`, clamped to `[0, 23]`); continuous bands (FCF, Dilatação/Descida, Pulso e P.A.) interpolate continuously across `[0, 23]` hours, clamped, matching the 24 numbered columns printed on the template's "hora do exame" row.

---

## File Structure

```
apps/web/
  package.json                                          [modify: add sharp]
  src/assets/partograph-template.png                     [new: copied reference template]
  src/lib/
    partograph-template-calibration.ts                   [new: pixel calibration constants]
    partograph-overlay-svg.ts                             [new: builds the full overlay SVG]
    partograph-image.ts                                   [rewritten: sharp compositing → PNG buffer]
    partograph-storage.ts                                 [new: upload PNG to `partograph` bucket]
    partograph-header-data.ts                             [new: fetch patient/pregnancy header info]
    partograph-pdf.ts                                     [rewritten: renders PDF from image buffer + header]
  src/components/shared/
    partograph-pdf-document.tsx                           [rewritten: header + <Image> of composed PNG]
  src/actions/
    export-partograph-pdf-action.ts                       [rewritten: image → upload → pdf]
  scripts/
    calibrate-partograph-template.ts                      [new, one-off: prints gridline pixel positions]

packages/supabase/supabase/migrations/
  <timestamp>_partograph_storage_bucket.sql                [new: bucket + RLS policies]
```

---

### Task 1: Add `sharp` dependency and the template asset

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/assets/partograph-template.png` (copy of `prompts/017-partograph/partograma_vs_ok.png`)

**Interfaces:**
- Produces: the `sharp` package resolvable from `apps/web`, and a 595×841 PNG at `apps/web/src/assets/partograph-template.png` that later tasks load via `path.join(process.cwd(), "src/assets/partograph-template.png")` (same pattern as `LOGO_PATH` in `contract-certificate-document.tsx:141`).

- [ ] **Step 1: Add the dependency**

```bash
cd apps/web && pnpm add sharp
```

- [ ] **Step 2: Copy the template asset**

```bash
cp prompts/017-partograph/partograma_vs_ok.png apps/web/src/assets/partograph-template.png
```

- [ ] **Step 3: Verify sharp resolves and the asset loads**

Create `/private/tmp/claude-scratch/verify-sharp.ts` (adjust to your scratchpad path) with:

```ts
import path from "node:path";
import sharp from "sharp";

const templatePath = path.join(process.cwd(), "apps/web/src/assets/partograph-template.png");

sharp(templatePath)
  .metadata()
  .then((meta) => console.log("width:", meta.width, "height:", meta.height))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

Run: `npx tsx /private/tmp/claude-scratch/verify-sharp.ts` from the repo root.
Expected: `width: 595 height: 841`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/assets/partograph-template.png
git commit -m "chore(birth-mode): add sharp dependency and partograma template asset"
```

---

### Task 2: Storage bucket migration

**Files:**
- Create: `packages/supabase/supabase/migrations/<timestamp>_partograph_storage_bucket.sql` (use the current UTC timestamp in `YYYYMMDDHHMMSS` form, matching the existing migration filenames in that directory)

**Interfaces:**
- Produces: bucket id `partograph` in `storage.buckets`, private, 10MB limit. RLS allows INSERT/SELECT to team members of the pregnancy whose id is the object's top-level folder, plus the pregnancy's own patient (if they have a user account), following the exact pattern of `patient_documents` (`packages/supabase/supabase/migrations/20260206000000_patient_documents.sql:26-46`) and `payments` (`packages/supabase/supabase/migrations/20260213000002_payment_receipts.sql`).

- [ ] **Step 1: Write the migration**

```sql
-- Storage bucket for partograma template overlays, one folder per pregnancy id.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('partograph', 'partograph', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- SELECT: team members of the pregnancy's patient, or the patient themselves.
CREATE POLICY "View partograph images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'partograph'
  AND EXISTS (
    SELECT 1 FROM public.pregnancies preg
    JOIN public.patients pat ON pat.id = preg.patient_id
    WHERE preg.id = (storage.foldername(name))[1]::uuid
      AND (public.is_team_member(pat.id) OR pat.user_id = auth.uid())
  )
);

-- INSERT: team members of the pregnancy's patient, or the patient themselves.
CREATE POLICY "Upload partograph images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partograph'
  AND EXISTS (
    SELECT 1 FROM public.pregnancies preg
    JOIN public.patients pat ON pat.id = preg.patient_id
    WHERE preg.id = (storage.foldername(name))[1]::uuid
      AND (public.is_team_member(pat.id) OR pat.user_id = auth.uid())
  )
);
```

- [ ] **Step 2: Apply the migration**

```bash
pnpm db:push
```

- [ ] **Step 3: Verify the bucket exists**

```bash
pnpm db:pull  # or check via mcp__supabase__execute_sql:
# select id, public, file_size_limit from storage.buckets where id = 'partograph';
```

Expected: one row, `public = false`, `file_size_limit = 10485760`.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/<timestamp>_partograph_storage_bucket.sql
git commit -m "feat(birth-mode): add partograph storage bucket with team-member RLS"
```

---

### Task 3: Calibrate the template grid

**Files:**
- Create: `apps/web/scripts/calibrate-partograph-template.ts` (one-off dev tool, not wired into any `package.json` script — run manually and discarded)
- Create: `apps/web/src/lib/partograph-template-calibration.ts`

**Interfaces:**
- Consumes: `apps/web/src/assets/partograph-template.png` (Task 1)
- Produces:
  ```ts
  export const TEMPLATE_WIDTH = 595;
  export const TEMPLATE_HEIGHT = 841;

  export type ContinuousBand = {
    x0: number; y1() ... // see full shape below
  };
  ```
  Full exported shape (used by Tasks 4-9):
  ```ts
  export type ContinuousBand = {
    x0: number; // pixel x of hour column 1 (elapsed hour 0)
    x1: number; // pixel x of hour column 24 (elapsed hour 23)
    yTop: number; // pixel y of the row for `valueMax`
    yBottom: number; // pixel y of the row for `valueMin`
    valueMin: number;
    valueMax: number;
  };

  export type ColumnBand = {
    columnX: number[]; // pixel x center of each of the 24 hour columns, index 0 = hour 1
    yTop: number;
    yBottom: number;
  };

  export const FCF_BAND: ContinuousBand = { ... };
  export const DILATION_BAND: ContinuousBand = { ... };   // 0-10cm
  export const STATION_BAND: ContinuousBand = { ... };    // -3..+4 De Lee, mirrored right axis, same x0/x1/yTop/yBottom as DILATION_BAND
  export const PULSE_PA_BAND: ContinuousBand = { ... };   // 60-180
  export const CONTRACTIONS_BAND: ColumnBand & { valueMin: 0; valueMax: 5 } = { ... };
  export const OXYTOCIN_ROW: ColumnBand = { ... };        // text row (U/L + gtt/min stacked)
  export const MEDICATION_ROW: ColumnBand = { ... };
  export const LA_BOLSA_ROW: ColumnBand = { ... };
  export const TEMPERATURE_ROW: ColumnBand = { ... };
  export const URINE_PROTEIN_ROW: ColumnBand = { ... };
  export const URINE_KETONE_ROW: ColumnBand = { ... };
  export const URINE_VOLUME_ROW: ColumnBand = { ... };
  ```

- [ ] **Step 1: Write the gridline-detection script**

```ts
// apps/web/scripts/calibrate-partograph-template.ts
// One-off tool: prints the pixel y-position of every horizontal gridline and the
// pixel x-position of every vertical gridline in the template, so band boundaries
// can be read off precisely instead of eyeballed. Not part of the production build.
import path from "node:path";
import sharp from "sharp";

async function main() {
  const templatePath = path.join(process.cwd(), "apps/web/src/assets/partograph-template.png");
  const { data, info } = await sharp(templatePath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const darkness = (x: number, y: number) => 255 - (data[y * width + x] ?? 255);

  // A row is a horizontal gridline if most pixels across the full width are dark.
  const rowScores: number[] = [];
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += darkness(x, y) > 100 ? 1 : 0;
    rowScores.push(sum / width);
  }

  // A column is a vertical gridline if most pixels down the full height are dark.
  const colScores: number[] = [];
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += darkness(x, y) > 100 ? 1 : 0;
    colScores.push(sum / height);
  }

  function clusterAboveThreshold(scores: number[], threshold: number): number[] {
    const lines: number[] = [];
    let clusterStart = -1;
    for (let i = 0; i < scores.length; i++) {
      const above = (scores[i] ?? 0) > threshold;
      if (above && clusterStart === -1) clusterStart = i;
      if (!above && clusterStart !== -1) {
        lines.push(Math.round((clusterStart + i - 1) / 2));
        clusterStart = -1;
      }
    }
    if (clusterStart !== -1) lines.push(Math.round((clusterStart + scores.length - 1) / 2));
    return lines;
  }

  console.log("horizontal gridlines (y):", clusterAboveThreshold(rowScores, 0.4));
  console.log("vertical gridlines (x):", clusterAboveThreshold(colScores, 0.4));
}

main();
```

- [ ] **Step 2: Run it and capture the output**

```bash
npx tsx apps/web/scripts/calibrate-partograph-template.ts
```

This prints two arrays of pixel positions. Cross-reference them against the reference
image (`prompts/017-partograph/partograma_vs_ok.png`, opened at full zoom) to identify,
top-to-bottom, which horizontal gridline cluster belongs to which band label ("frequência
cardíaca fetal", "L.A. / Bolsa", "dilatação do colo / descida da cabeça", "contrações em 10
min.", "ocitocina", "medicamentos", "pulso e p.a.", "temperatura", "urina" rows), and which
vertical gridlines are the 24 numbered hour columns under "hora do exame" (the same x
positions apply to every band, since the grid is a single continuous table).

- [ ] **Step 3: Write the calibration constants file**

Using the y-positions identified in Step 2 for each band's top/bottom gridline and the 24
x-positions for the hour columns, write:

```ts
// apps/web/src/lib/partograph-template-calibration.ts
// Pixel coordinates measured from apps/web/src/assets/partograph-template.png (595x841,
// A4 @72dpi) using apps/web/scripts/calibrate-partograph-template.ts. Re-run that script
// if the template asset is ever replaced.

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

// Replace every number below with the values read off the calibration script's output.
export const FCF_BAND: ContinuousBand = { x0: 0, x1: 0, yTop: 0, yBottom: 0, valueMin: 100, valueMax: 180 };
export const DILATION_BAND: ContinuousBand = { x0: 0, x1: 0, yTop: 0, yBottom: 0, valueMin: 0, valueMax: 10 };
export const STATION_BAND: ContinuousBand = { x0: 0, x1: 0, yTop: 0, yBottom: 0, valueMin: -3, valueMax: 4 };
export const PULSE_PA_BAND: ContinuousBand = { x0: 0, x1: 0, yTop: 0, yBottom: 0, valueMin: 60, valueMax: 180 };

export const CONTRACTIONS_BAND: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const OXYTOCIN_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const MEDICATION_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const LA_BOLSA_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const TEMPERATURE_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const URINE_PROTEIN_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const URINE_KETONE_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
export const URINE_VOLUME_ROW: ColumnBand = { columnX: [], yTop: 0, yBottom: 0 };
```

`DILATION_BAND` and `STATION_BAND` share the same `x0`/`x1`/`yTop`/`yBottom` (they're the
same grid, read on two different scales — 0-10cm on the left axis, -3..+4 on the mirrored
right axis) — only `valueMin`/`valueMax` differ. For every `ColumnBand`, `columnX` must have
exactly 24 entries (hour columns 1-24, left to right).

- [ ] **Step 4: Verify by rendering a debug overlay**

```ts
// /private/tmp/claude-scratch/verify-calibration.ts
import path from "node:path";
import sharp from "sharp";
import {
  TEMPLATE_WIDTH, TEMPLATE_HEIGHT,
  FCF_BAND, DILATION_BAND, STATION_BAND, PULSE_PA_BAND,
  CONTRACTIONS_BAND, OXYTOCIN_ROW, MEDICATION_ROW, LA_BOLSA_ROW,
  TEMPERATURE_ROW, URINE_PROTEIN_ROW, URINE_KETONE_ROW, URINE_VOLUME_ROW,
} from "../../apps/web/src/lib/partograph-template-calibration";

const bands = {
  FCF_BAND, DILATION_BAND, STATION_BAND, PULSE_PA_BAND,
  CONTRACTIONS_BAND, OXYTOCIN_ROW, MEDICATION_ROW, LA_BOLSA_ROW,
  TEMPERATURE_ROW, URINE_PROTEIN_ROW, URINE_KETONE_ROW, URINE_VOLUME_ROW,
};

const rects = Object.entries(bands)
  .map(([name, band]) => {
    const x0 = "x0" in band ? band.x0 : Math.min(...band.columnX);
    const x1 = "x1" in band ? band.x1 : Math.max(...band.columnX);
    return `<rect x="${x0}" y="${band.yTop}" width="${x1 - x0}" height="${band.yBottom - band.yTop}" fill="none" stroke="red" stroke-width="1"/><text x="${x0}" y="${band.yTop - 2}" font-size="6" fill="red">${name}</text>`;
  })
  .join("");

const svg = `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;

sharp(path.join(process.cwd(), "apps/web/src/assets/partograph-template.png"))
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile("/private/tmp/claude-scratch/calibration-debug.png")
  .then(() => console.log("written"));
```

Run: `npx tsx /private/tmp/claude-scratch/verify-calibration.ts`, then open
`/private/tmp/claude-scratch/calibration-debug.png` and confirm every red box sits exactly
on its named band's grid in the template (adjust the constants in
`partograph-template-calibration.ts` and re-run until they line up).

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/calibrate-partograph-template.ts apps/web/src/lib/partograph-template-calibration.ts
git commit -m "feat(birth-mode): calibrate partograma template grid coordinates"
```

---

### Task 4: Overlay core helpers + FCF band

**Files:**
- Create: `apps/web/src/lib/partograph-overlay-svg.ts`

**Interfaces:**
- Consumes: `BirthModeTimelineEvent` (`@/actions/get-birth-mode-timeline-action`), `resolveChartT0`/`hoursSince` (`@/lib/birth-mode-chart-utils`), calibration constants from Task 3.
- Produces:
  ```ts
  export function mapContinuousX(band: { x0: number; x1: number }, hoursSinceT0: number): number
  export function mapContinuousY(band: { yTop: number; yBottom: number; valueMin: number; valueMax: number }, value: number): number
  export function nearestHourColumn(hoursSinceT0: number): number // 0-23, used to index ColumnBand.columnX
  export function buildFcfElements(events: BirthModeTimelineEvent[], t0: number): string // SVG fragment
  export function buildPartographOverlaySvg(events: BirthModeTimelineEvent[]): string // full <svg>...</svg>, empty bands render nothing
  ```
  `buildPartographOverlaySvg` is the entry point later tasks extend (each task adds its
  band's elements into the same function) and that `partograph-image.ts` (Task 9) calls.

- [ ] **Step 1: Write the coordinate helpers, SVG shell, and FCF band**

```ts
// apps/web/src/lib/partograph-overlay-svg.ts
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import {
  FCF_BAND,
  TEMPLATE_HEIGHT,
  TEMPLATE_WIDTH,
  type ColumnBand,
  type ContinuousBand,
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
```

- [ ] **Step 2: Verify against the template**

```ts
// /private/tmp/claude-scratch/verify-fcf.ts
import path from "node:path";
import sharp from "sharp";
import { buildPartographOverlaySvg } from "../../apps/web/src/lib/partograph-overlay-svg";

const events = [
  { type: "start_monitoring", id: "s1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: {} },
  { type: "fetal_heart_rate", id: "f1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: { bpm: 140 } },
  { type: "fetal_heart_rate", id: "f2", occurredAt: "2026-08-22T10:00:00Z", professionalId: null, professionalName: "x", payload: { bpm: 155 } },
  { type: "fetal_heart_rate", id: "f3", occurredAt: "2026-08-22T13:00:00Z", professionalId: null, professionalName: "x", payload: { bpm: 130 } },
] as const;

const svg = buildPartographOverlaySvg(events as never);

sharp(path.join(process.cwd(), "apps/web/src/assets/partograph-template.png"))
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile("/private/tmp/claude-scratch/fcf-debug.png")
  .then(() => console.log("written"));
```

Run: `npx tsx /private/tmp/claude-scratch/verify-fcf.ts`, open `fcf-debug.png`, confirm the
three FCF points and connecting line sit inside the "frequência cardíaca fetal" grid at the
correct rows (140/155/130 bpm) and roughly 0h/2h/5h across the width.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-overlay-svg.ts
git commit -m "feat(birth-mode): add partograph overlay SVG core helpers and FCF band"
```

---

### Task 5: Dilatação/Descida band

**Files:**
- Modify: `apps/web/src/lib/partograph-overlay-svg.ts`

**Interfaces:**
- Consumes: `computeAlertActionLines` (`@/lib/birth-mode-chart-utils`), `DILATION_BAND`/`STATION_BAND` (Task 3), `mapContinuousX`/`mapContinuousY` (Task 4).
- Produces: `buildDilationStationElements(events, t0): string`, wired into `buildPartographOverlaySvg`.

- [ ] **Step 1: Add the band function and wire it in**

```ts
// add to imports:
import { computeAlertActionLines, type ChartPoint } from "@/lib/birth-mode-chart-utils";
import { DILATION_BAND, STATION_BAND } from "@/lib/partograph-template-calibration";

const DILATION_COLOR = "#1d4ed8";
const STATION_COLOR = "#f97316";
const ALERT_COLOR = "#eab308";
const ACTION_COLOR = "#ef4444";

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
```

In `buildPartographOverlaySvg`, add `const dilationStation = buildDilationStationElements(events, t0);`
and include it in the returned template string alongside `fcf`.

- [ ] **Step 2: Verify**

Extend the Task 4 verification script with `cervical_dilation` and `fetal_station` events
(e.g. dilation 3cm at hour 0 rising to 9cm at hour 6, station -2 to +1 over the same range),
re-run, and open the output PNG. Confirm: triangle apexes sit exactly on the dilation
values, circles sit on the station values on the mirrored right axis, and the yellow/red
alert/action lines start where dilation first reaches 4cm.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-overlay-svg.ts
git commit -m "feat(birth-mode): add dilatacao/descida band to partograph overlay"
```

---

### Task 6: Pulso e P.A. band

**Files:**
- Modify: `apps/web/src/lib/partograph-overlay-svg.ts`

**Interfaces:**
- Consumes: `PULSE_PA_BAND` (Task 3), `mapContinuousX`/`mapContinuousY` (Task 4).
- Produces: `buildPulsePaElements(events, t0): string`, wired into `buildPartographOverlaySvg`.

- [ ] **Step 1: Add the band function and wire it in**

```ts
const PULSE_COLOR = "#eab308";
const PA_COLOR = "#3b82f6";

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
```

Wire into `buildPartographOverlaySvg` the same way as Task 5.

- [ ] **Step 2: Verify**

Add `maternal_vitals` events (e.g. systolic 120/diastolic 80/pulse 88 at hour 0, systolic
130/diastolic 85/pulse 95 at hour 4) to the verification script, re-run, confirm the double
arrows span systolic-to-diastolic at the right rows and the pulse dots/line sit at the
correct row.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-overlay-svg.ts
git commit -m "feat(birth-mode): add pulso e p.a. band to partograph overlay"
```

---

### Task 7: Contrações band (bar histogram with duration hatching)

**Files:**
- Modify: `apps/web/src/lib/partograph-overlay-svg.ts`

**Interfaces:**
- Consumes: `CONTRACTIONS_BAND` (Task 3), `columnX`/`nearestHourColumn` (Task 4).
- Produces: `buildContractionsElements(events, t0): string`, plus the two `<pattern>` defs it needs, wired into `buildPartographOverlaySvg`.

- [ ] **Step 1: Add the hatch pattern defs and the band function**

```ts
import { CONTRACTIONS_BAND } from "@/lib/partograph-template-calibration";

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
```

Wire into `buildPartographOverlaySvg` the same way as Task 5.

- [ ] **Step 2: Verify**

Add several `contraction` events with different `duration_seconds` values (15s, 30s, 50s)
spread across a few hours, re-run the verification script, confirm bar heights match
frequency and the fill pattern changes (dotted / hatched / solid) with duration.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-overlay-svg.ts
git commit -m "feat(birth-mode): add contracoes band to partograph overlay"
```

---

### Task 8: Column-text bands (L.A./Bolsa, Ocitocina, Medicamentos, Temperatura, Urina)

**Files:**
- Modify: `apps/web/src/lib/partograph-overlay-svg.ts`

**Interfaces:**
- Consumes: `OXYTOCIN_ROW`, `MEDICATION_ROW`, `LA_BOLSA_ROW`, `TEMPERATURE_ROW`, `URINE_PROTEIN_ROW`, `URINE_KETONE_ROW`, `URINE_VOLUME_ROW` (Task 3); `AMNIOTIC_FLUID_TYPE_LABELS`, `BIRTH_MEDICATION_TYPE_LABELS`, `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS`, `BIRTH_URINE_DIPSTICK_LABELS` (`@/lib/birth-mode-constants`).
- Produces: `buildColumnTextBands(events, t0): string`, wired into `buildPartographOverlaySvg`.

- [ ] **Step 1: Add the shared text-stamp helper and each row's data extraction**

```ts
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_MEDICATION_TYPE_LABELS,
  BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS,
  BIRTH_URINE_DIPSTICK_LABELS,
} from "@/lib/birth-mode-constants";
import {
  LA_BOLSA_ROW,
  MEDICATION_ROW,
  OXYTOCIN_ROW,
  TEMPERATURE_ROW,
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
```

Note: `BIRTH_URINE_DIPSTICK_LABELS` is imported for consistency with the rest of the file's
label-lookup pattern even though `DIPSTICK_SHORT_LABELS` is used for the actual glyphs — if
you prefer, drop the unused import instead.

Wire into `buildPartographOverlaySvg` the same way as Task 5.

- [ ] **Step 2: Verify**

Add one event of each remaining type (`amniotic_fluid`, `membrane_rupture`, `medication`
with `medication_type: "ocitocina"` and one with `"analgesia"`, `maternal_vitals` with a
`temperature_celsius`, `urine_test`) to the verification script, re-run, confirm each text
stamp lands in its row at the right hour column.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-overlay-svg.ts
git commit -m "feat(birth-mode): add column-text bands to partograph overlay"
```

---

### Task 9: `partograph-image.ts` — compose the final PNG

**Files:**
- Rewrite: `apps/web/src/lib/partograph-image.ts`

**Interfaces:**
- Consumes: `buildPartographOverlaySvg` (Task 4-8), `apps/web/src/assets/partograph-template.png` (Task 1).
- Produces:
  ```ts
  export async function renderPartographImageBuffer(
    events: BirthModeTimelineEvent[],
  ): Promise<Buffer> // flattened PNG, 595x841
  ```
  Consumed by Task 12 (PDF document) and Task 13 (storage upload + export action).

- [ ] **Step 1: Rewrite the module**

```ts
// apps/web/src/lib/partograph-image.ts
// Server-only module: imports sharp. Never import from client components.
import path from "node:path";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { buildPartographOverlaySvg } from "@/lib/partograph-overlay-svg";
import sharp from "sharp";

const TEMPLATE_PATH = path.join(process.cwd(), "src/assets/partograph-template.png");

export async function renderPartographImageBuffer(
  events: BirthModeTimelineEvent[],
): Promise<Buffer> {
  const svg = buildPartographOverlaySvg(events);
  return sharp(TEMPLATE_PATH)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}
```

- [ ] **Step 2: Verify**

```ts
// /private/tmp/claude-scratch/verify-image.ts
import { renderPartographImageBuffer } from "../../apps/web/src/lib/partograph-image";
import { writeFileSync } from "node:fs";

const events = [
  { type: "start_monitoring", id: "s1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: {} },
  { type: "cervical_dilation", id: "d1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: { dilation_cm: 4 } },
  { type: "cervical_dilation", id: "d2", occurredAt: "2026-08-22T12:00:00Z", professionalId: null, professionalName: "x", payload: { dilation_cm: 9 } },
] as const;

renderPartographImageBuffer(events as never).then((buffer) => {
  writeFileSync("/private/tmp/claude-scratch/full-image-debug.png", buffer);
  console.log("bytes:", buffer.byteLength);
});
```

Run: `npx tsx /private/tmp/claude-scratch/verify-image.ts` (run from `apps/web` so
`process.cwd()` resolves `TEMPLATE_PATH` correctly, or `cd apps/web && npx tsx ...`).
Open `full-image-debug.png` and confirm the whole template renders with the overlay.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-image.ts
git commit -m "feat(birth-mode): compose partograma overlay onto template via sharp"
```

---

### Task 10: `partograph-storage.ts` — upload to the bucket

**Files:**
- Create: `apps/web/src/lib/partograph-storage.ts`

**Interfaces:**
- Consumes: `createServerSupabaseAdmin` return type (`@ventre/supabase/server`).
- Produces:
  ```ts
  export async function uploadPartographImage({
    supabaseAdmin, pregnancyId, buffer,
  }: {
    supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>;
    pregnancyId: string;
    buffer: Buffer;
  }): Promise<{ storagePath: string }>
  ```
  Consumed by Task 13 (export action). Failures are caught by the caller, not here (see
  Global Constraints — best-effort, must not block PDF generation).

- [ ] **Step 1: Write the module**

```ts
// apps/web/src/lib/partograph-storage.ts
// Server-only module. Never import from client components.
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function uploadPartographImage({
  supabaseAdmin,
  pregnancyId,
  buffer,
}: {
  supabaseAdmin: SupabaseAdmin;
  pregnancyId: string;
  buffer: Buffer;
}): Promise<{ storagePath: string }> {
  const storagePath = `${pregnancyId}/partograma_${Date.now()}.png`;

  const { error } = await supabaseAdmin.storage
    .from("partograph")
    .upload(storagePath, buffer, { contentType: "image/png", upsert: false });

  if (error) throw new Error(error.message);

  return { storagePath };
}
```

- [ ] **Step 2: Verify**

```ts
// /private/tmp/claude-scratch/verify-storage.ts
// Requires a real pregnancy id from your dev database and SUPABASE env vars loaded
// (run via `cd apps/web && npx dotenv -e .env.local -- npx tsx ../../<this script>`,
// or source the env vars however this repo already does for one-off scripts).
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { uploadPartographImage } from "../../apps/web/src/lib/partograph-storage";

async function main() {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { storagePath } = await uploadPartographImage({
    supabaseAdmin,
    pregnancyId: "<a real pregnancy id from your dev DB>",
    buffer: Buffer.from("test"),
  });
  console.log("uploaded:", storagePath);
}

main();
```

Run it, then confirm the object exists via
`mcp__supabase__execute_sql`: `select name from storage.objects where bucket_id = 'partograph';`
— expect one row matching `<pregnancyId>/partograma_<timestamp>.png`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-storage.ts
git commit -m "feat(birth-mode): upload composed partograma image to storage"
```

---

### Task 11: `partograph-header-data.ts` — patient/pregnancy header info

**Files:**
- Create: `apps/web/src/lib/partograph-header-data.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` return type, `calculateGestationalAge` (`@/lib/gestational-age`).
- Produces:
  ```ts
  export type PartographHeaderInfo = {
    patientName: string;
    dum: string | null;
    dueDate: string | null;
    gestationalAgeLabel: string | null; // e.g. "38 semanas e 2 dias", null if no dum
  };

  export async function fetchPartographHeaderInfo(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    pregnancyId: string,
  ): Promise<PartographHeaderInfo>
  ```
  Consumed by Task 13 (export action).

- [ ] **Step 1: Write the module**

```ts
// apps/web/src/lib/partograph-header-data.ts
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PartographHeaderInfo = {
  patientName: string;
  dum: string | null;
  dueDate: string | null;
  gestationalAgeLabel: string | null;
};

export async function fetchPartographHeaderInfo(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<PartographHeaderInfo> {
  const { data: pregnancy, error } = await supabase
    .from("pregnancies")
    .select("dum, due_date, patient:patients(name)")
    .eq("id", pregnancyId)
    .single();

  if (error || !pregnancy) throw new Error(error?.message ?? "Gestação não encontrada");

  const gestationalAge = calculateGestationalAge(pregnancy.dum);

  return {
    patientName: (pregnancy.patient as { name: string } | null)?.name ?? "Paciente",
    dum: pregnancy.dum,
    dueDate: pregnancy.due_date,
    gestationalAgeLabel: gestationalAge?.fullLabel ?? null,
  };
}
```

- [ ] **Step 2: Verify**

```ts
// /private/tmp/claude-scratch/verify-header-data.ts
import { createServerSupabaseClient } from "@ventre/supabase/server";
import { fetchPartographHeaderInfo } from "../../apps/web/src/lib/partograph-header-data";

async function main() {
  const supabase = await createServerSupabaseClient();
  const info = await fetchPartographHeaderInfo(supabase, "<a real pregnancy id>");
  console.log(info);
}

main();
```

Run it (same env-loading caveat as Task 10), confirm the printed object has the expected
patient name, dum, due_date, and a sensible gestational age label.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/partograph-header-data.ts
git commit -m "feat(birth-mode): fetch patient/pregnancy info for partograma pdf header"
```

---

### Task 12: Rewrite the PDF document and renderer

**Files:**
- Rewrite: `apps/web/src/components/shared/partograph-pdf-document.tsx`
- Rewrite: `apps/web/src/lib/partograph-pdf.ts`

**Interfaces:**
- Consumes: `PartographHeaderInfo` (Task 11), `renderPartographImageBuffer` (Task 9).
- Produces:
  ```ts
  // partograph-pdf-document.tsx
  export type PartographPdfData = {
    headerInfo: PartographHeaderInfo;
    imageBuffer: Buffer | null; // null renders the "sem dados" message
  };
  export function PartographPdfDocument({ data }: { data: PartographPdfData }): JSX.Element

  // partograph-pdf.ts
  export async function renderPartographPdfBuffer(data: PartographPdfData): Promise<Buffer>
  export function buildPartographPdfFileName(patientName: string): string // unchanged
  ```
  Consumed by Task 13 (export action).

- [ ] **Step 1: Rewrite `partograph-pdf-document.tsx`**

```tsx
// apps/web/src/components/shared/partograph-pdf-document.tsx
import type { PartographHeaderInfo } from "@/lib/partograph-header-data";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import path from "node:path";

export type PartographPdfData = {
  headerInfo: PartographHeaderInfo;
  imageBuffer: Buffer | null;
};

const LOGO_PATH = path.join(process.cwd(), "src/assets/ventre.png");

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: "1 solid #e5e7eb",
  },
  logo: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  headerInfo: {
    flexGrow: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  partographImage: {
    width: 545,
  },
  emptyMessage: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 24,
  },
});

export function PartographPdfDocument({ data }: { data: PartographPdfData }) {
  const { headerInfo, imageBuffer } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Partograma — {headerInfo.patientName}</Text>
            <Text style={styles.subtitle}>
              {headerInfo.gestationalAgeLabel
                ? `Idade gestacional: ${headerInfo.gestationalAgeLabel}`
                : "Idade gestacional: não informada"}
              {headerInfo.dueDate ? ` · DPP: ${dayjs(headerInfo.dueDate).format("DD/MM/YYYY")}` : ""}
            </Text>
            <Text style={styles.subtitle}>
              Modelo classico (Ministerio da Saude) — gerado em {dayjs().format("DD/MM/YYYY HH:mm")}
            </Text>
          </View>
        </View>
        {imageBuffer ? (
          <Image
            src={`data:image/png;base64,${imageBuffer.toString("base64")}`}
            style={styles.partographImage}
          />
        ) : (
          <Text style={styles.emptyMessage}>Sem dados suficientes para gerar o partograma.</Text>
        )}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Rewrite `partograph-pdf.ts`**

```ts
// apps/web/src/lib/partograph-pdf.ts
import {
  PartographPdfDocument,
  type PartographPdfData,
} from "@/components/shared/partograph-pdf-document";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.

export async function renderPartographPdfBuffer(data: PartographPdfData): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(PartographPdfDocument, { data }) as React.ReactElement<DocumentProps>,
  );
}

function sanitizePatientNameForFile(patientName: string): string {
  return patientName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();
}

export function buildPartographPdfFileName(patientName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `PARTOGRAMA_${sanitizePatientNameForFile(patientName)}_${dateStr}.pdf`;
}
```

- [ ] **Step 3: Verify**

```ts
// /private/tmp/claude-scratch/verify-pdf.ts
import { renderPartographPdfBuffer } from "../../apps/web/src/lib/partograph-pdf";
import { renderPartographImageBuffer } from "../../apps/web/src/lib/partograph-image";
import { writeFileSync } from "node:fs";

async function main() {
  const events = [
    { type: "start_monitoring", id: "s1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: {} },
    { type: "cervical_dilation", id: "d1", occurredAt: "2026-08-22T08:00:00Z", professionalId: null, professionalName: "x", payload: { dilation_cm: 4 } },
  ] as const;

  const imageBuffer = await renderPartographImageBuffer(events as never);
  const pdfBuffer = await renderPartographPdfBuffer({
    headerInfo: {
      patientName: "Maria Teste",
      dum: "2026-01-01",
      dueDate: "2026-10-08",
      gestationalAgeLabel: "33 semanas e 1 dia",
    },
    imageBuffer,
  });

  writeFileSync("/private/tmp/claude-scratch/full-pdf-debug.pdf", pdfBuffer);
  console.log("bytes:", pdfBuffer.byteLength);
}

main();
```

Run from `apps/web` (so `LOGO_PATH`/`TEMPLATE_PATH` resolve): `cd apps/web && npx tsx
../../<script path>`. Open `full-pdf-debug.pdf` and confirm the header (logo, patient name,
gestational age, DPP) renders above the composed partograma image.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/shared/partograph-pdf-document.tsx apps/web/src/lib/partograph-pdf.ts
git commit -m "feat(birth-mode): add ventre-branded header to partograma pdf"
```

---

### Task 13: Wire up the export action

**Files:**
- Rewrite: `apps/web/src/actions/export-partograph-pdf-action.ts`

**Interfaces:**
- Consumes: `fetchBirthModeTimelineData` (existing), `fetchPartographHeaderInfo` (Task 11), `renderPartographImageBuffer` (Task 9), `uploadPartographImage` (Task 10), `renderPartographPdfBuffer`/`buildPartographPdfFileName` (Task 12).
- Produces: same action shape as before — `{ pdfBase64: string; fileName: string }` — so no caller changes are needed elsewhere in the app.

- [ ] **Step 1: Rewrite the action**

```ts
// apps/web/src/actions/export-partograph-pdf-action.ts
"use server";

import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";
import { fetchPartographHeaderInfo } from "@/lib/partograph-header-data";
import { renderPartographImageBuffer } from "@/lib/partograph-image";
import { buildPartographPdfFileName, renderPartographPdfBuffer } from "@/lib/partograph-pdf";
import { uploadPartographImage } from "@/lib/partograph-storage";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const exportPartographPdfAction = authActionClient
  .inputSchema(z.object({ pregnancyId: z.string().uuid() }))
  .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase, supabaseAdmin } }) => {
    const [{ events }, headerInfo] = await Promise.all([
      fetchBirthModeTimelineData(supabase, pregnancyId),
      fetchPartographHeaderInfo(supabase, pregnancyId),
    ]);

    const imageBuffer = events.length > 0 ? await renderPartographImageBuffer(events) : null;

    if (imageBuffer) {
      try {
        await uploadPartographImage({ supabaseAdmin, pregnancyId, buffer: imageBuffer });
      } catch (error) {
        // Best-effort: the Storage copy is an audit artifact, not required for the
        // export itself — the buffer already in memory is what goes into the PDF.
        console.error("[exportPartographPdfAction] falha ao salvar imagem no storage", error);
      }
    }

    const buffer = await renderPartographPdfBuffer({ headerInfo, imageBuffer });

    return {
      pdfBase64: buffer.toString("base64"),
      fileName: buildPartographPdfFileName(headerInfo.patientName),
    };
  });
```

- [ ] **Step 2: Type-check the whole app**

```bash
pnpm check-types
```

Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification**

Run the dev server (`pnpm --filter web dev`), open a pregnancy with birth-mode data past
the partograma threshold, trigger the "Exportar PDF" action from the UI, and confirm:
1. The downloaded PDF has the Ventre header with correct patient/gestational info.
2. The composed partograma image matches the reference template with data correctly
   plotted per band.
3. A new object appears under `partograph/<pregnancyId>/` in Supabase Storage (check via
   `mcp__supabase__execute_sql` or the dashboard).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/export-partograph-pdf-action.ts
git commit -m "feat(birth-mode): wire partograma export to template overlay, storage and pdf header"
```

---

## Self-review notes

- **Spec coverage:** template overlay (Tasks 4-9), all nine bands with their confirmed
  symbols (Tasks 4-8), storage bucket + per-pregnancy folder + kept history (Tasks 2, 10),
  PDF header with logo + patient/pregnancy info (Tasks 11-12), export action wiring
  (Task 13), triangle-apex requirement (Task 5, called out explicitly in Global Constraints
  and in code comment). The spec's "fora de escopo" items (template's own demographic
  header fields, storage browsing UI, automated visual tests) are intentionally not
  covered by any task.
- **Type consistency:** `ColumnBand`/`ContinuousBand` types are defined once in Task 3 and
  reused verbatim by name in every later task; `BirthModeTimelineEvent`/payload shapes match
  `get-birth-mode-timeline-action.ts` and `birth-mode-timeline-data.ts` exactly (verified
  against the actual source during planning); `PartographPdfData` shape is defined in
  Task 12 and consumed unchanged in Task 13.
- **No placeholders:** the only intentionally-empty values are the calibration constants in
  Task 3, which are empirical (produced by running the calibration script against the real
  template image) — Task 3 Steps 2-4 give the exact procedure and a verification render to
  confirm the values are correct before moving on, so nothing is left unresolved past that
  task.
