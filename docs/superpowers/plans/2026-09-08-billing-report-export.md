# Exportação de Relatório Financeiro (PDF/Excel/CSV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a professional export her monthly billing report (currently only viewable on screen) as PDF, Excel or CSV from `billing-dashboard-screen.tsx`.

**Architecture:** A new isomorphic data-aggregation function (`getBillingReportData`) reuses the existing pure functions `groupBillingsByStatusSections` and `computeAmountCents` to build one shared report shape. A single server action (`exportBillingReportAction`) dynamically imports the right generator (PDF via `@react-pdf/renderer`, Excel via new `exceljs` dependency, CSV via a hand-rolled escaper) and returns a base64 buffer the client decodes into a downloadable file — mirroring the existing `exportPartographPdfAction` pattern.

**Tech Stack:** Next.js 15 / React 19, `next-safe-action`, `@react-pdf/renderer` (already a dependency), `exceljs` (new dependency), Vitest, shadcn `button-group`.

**Spec:** [docs/superpowers/specs/2026-09-08-billing-report-export-design.md](../specs/2026-09-08-billing-report-export-design.md)

## Global Constraints

- All user-facing strings in pt-BR.
- Export is always self-service: `professionalId` is always the logged-in user (`ctx.user.id`), never another professional.
- Period picker in the export modal is a single month/year (no ranges), pre-filled with the screen's currently selected month, editable before confirming.
- Every row shows gross (bruto) and net (líquido) amounts side by side.
- PDF and Excel include a subtotal (bruto/líquido) per status section plus one grand total. CSV contains **only** the header row and data rows — no title row, no subtotal rows.
- Columns, same order in all 3 formats: Gestante, Descrição, Parcela, Status, Data de Vencimento, Data de Pagamento, Valor Bruto, Valor Líquido.
- File name: `relatorio-financeiro-{YYYY-MM}.{ext}`.
- Mime types: PDF `application/pdf`, Excel `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, CSV `text/csv;charset=utf-8`.

---

### Task 1: `ButtonGroup` primitive in `packages/ui`

**Files:**
- Create: `packages/ui/src/button-group.tsx`
- Create: `apps/storybook/src/stories/ButtonGroup.stories.tsx`
- Temporary (deleted at end of task): `apps/web/src/components/ui/button-group.tsx`

**Interfaces:**
- Produces: `ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText` React components exported from `@ventre/ui/button-group`. `ButtonGroup` accepts `orientation?: "horizontal" | "vertical"` plus standard `div` props; children are ordinary `Button`/`DropdownMenu` components from `@ventre/ui/button` and `@ventre/ui/dropdown-menu` — no new variant plumbing is needed since the buttons inside the group already carry `button.tsx`'s own `variant`/`size` props.

`packages/ui` has no local `components.json`/Tailwind config (unlike `apps/web`), so the shadcn CLI can't place files there directly. `apps/web/src/components/ui` doesn't exist yet either — it's only used here as a scratch target to get the authoritative generated source, then the file is moved and import-adjusted into `packages/ui`, the same way every other primitive in that package (`dialog.tsx`, `dropdown-menu.tsx`, etc.) already imports `cn` from the local `./utils/utils` instead of `@/lib/utils`.

- [ ] **Step 1: Generate the primitive via the shadcn CLI**

Run from the repo root:

```bash
cd apps/web && pnpm dlx shadcn@latest add button-group
```

This creates `apps/web/src/components/ui/button-group.tsx` using the existing `apps/web/components.json` config (style `new-york`, no prompts needed since the config already exists).

- [ ] **Step 2: Move and adapt the generated file into `packages/ui`**

Read the generated `apps/web/src/components/ui/button-group.tsx`, then create `packages/ui/src/button-group.tsx` with the exact same content except the utils import:

```diff
-import { cn } from "@/lib/utils"
+import { cn } from "./utils/utils";
```

Keep every class name, `cva` variant, and exported symbol (`ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText`, and any `buttonGroupVariants` export) exactly as generated — this is a mechanical port, not a rewrite.

Delete the scratch file:

```bash
rm apps/web/src/components/ui/button-group.tsx
rmdir apps/web/src/components/ui 2>/dev/null || true
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check-types --filter=@ventre/ui`
Expected: no errors.

- [ ] **Step 4: Add a Storybook story**

```tsx
// apps/storybook/src/stories/ButtonGroup.stories.tsx
import { Button } from "@ventre/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@ventre/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ventre/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof ButtonGroup> = {
  title: "UI/ButtonGroup",
  component: ButtonGroup,
};
export default meta;

type Story = StoryObj<typeof ButtonGroup>;

export const Basic: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Um</Button>
      <Button variant="outline">Dois</Button>
    </ButtonGroup>
  ),
};

export const SplitWithDropdown: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Exportar em PDF</Button>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Exportar para Excel</DropdownMenuItem>
          <DropdownMenuItem>Exportar para CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  ),
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/button-group.tsx apps/storybook/src/stories/ButtonGroup.stories.tsx
git commit -m "feat(ui): add ButtonGroup primitive from shadcn

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Report data aggregation (`report-data.ts`)

**Files:**
- Create: `apps/web/src/lib/billing/report-data.ts`
- Test: `apps/web/src/lib/billing/report-data.test.ts`

**Interfaces:**
- Consumes: `groupBillingsByStatusSections(billings, month, filter)` from `@/lib/billing/dashboard` (returns `StatusSection[]`, each `{ key: "atrasado"|"pendente"|"pago", label, billings: GroupedBilling[] }`); `computeAmountCents(installment, appliedFees, professionalId)` and `getStatusConfig(status)` from `@/lib/billing/calculations`; `getMonthRange(month)` from `@/lib/billing/period-range`; `getBillings(startDate?, endDate?)` from `@/services/billing`; `dayjs` from `@/lib/dayjs`.
- Produces: `getBillingReportData(params: { professionalId: string; professionalName: string; month: string }): Promise<BillingReportData>`, and the types `BillingReportData`, `ReportSection`, `ReportInstallmentRow` — consumed by Tasks 3, 4, 5 and 6.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/billing/report-data.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { billingsResult } = vi.hoisted(() => ({
  billingsResult: { billings: [] as unknown[] },
}));

vi.mock("@/services/billing", () => ({
  getBillings: vi.fn(async () => billingsResult),
}));

import { getBillingReportData } from "./report-data";

function makeInstallment(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    installment_number: 1,
    amount: 10000,
    paid_amount: 0,
    status: "pendente",
    due_date: "2026-09-15",
    paid_at: null,
    splitted_installment: { "prof-1": 10000 },
    applied_installment_fees: [],
    ...overrides,
  };
}

function makeBilling(overrides: Record<string, unknown> = {}) {
  return {
    id: "billing-1",
    description: "Pré-natal",
    installment_count: 1,
    patient: { id: "patient-1", name: "Maria Silva" },
    installments: [makeInstallment()],
    ...overrides,
  };
}

describe("getBillingReportData", () => {
  beforeEach(() => {
    billingsResult.billings = [];
  });

  it("returns zeroed totals and empty rows when there are no billings", async () => {
    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    expect(result.totalGrossCents).toBe(0);
    expect(result.totalNetCents).toBe(0);
    expect(result.sections).toHaveLength(3);
    expect(result.sections.every((s) => s.rows.length === 0)).toBe(true);
  });

  it("groups a pending installment under the correct section with gross === net when there are no fees", async () => {
    billingsResult.billings = [makeBilling()];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const pendente = result.sections.find((s) => s.key === "pendente");
    expect(pendente?.rows).toHaveLength(1);
    expect(pendente?.rows[0]).toMatchObject({
      patientName: "Maria Silva",
      description: "Pré-natal",
      installmentLabel: "1/1",
      grossAmountCents: 10000,
      netAmountCents: 10000,
    });
    expect(pendente?.subtotalGrossCents).toBe(10000);
    expect(result.totalGrossCents).toBe(10000);
  });

  it("only reflects the requested professional's share of a split installment", async () => {
    billingsResult.billings = [
      makeBilling({
        installments: [
          makeInstallment({
            amount: 20000,
            splitted_installment: { "prof-1": 12000, "prof-2": 8000 },
          }),
        ],
      }),
    ];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const row = result.sections.find((s) => s.key === "pendente")?.rows[0];
    expect(row?.grossAmountCents).toBe(12000);
  });

  it("subtracts applied fees to compute the net amount", async () => {
    billingsResult.billings = [
      makeBilling({
        installments: [
          makeInstallment({
            applied_installment_fees: [
              {
                professional_id: "prof-1",
                fee_id: "fee-1",
                name: "Taxa da clínica",
                fee_type: "percentage",
                value: 10,
                base_amount_cents: 10000,
                computed_amount_cents: 1000,
              },
            ],
          }),
        ],
      }),
    ];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const row = result.sections.find((s) => s.key === "pendente")?.rows[0];
    expect(row?.grossAmountCents).toBe(10000);
    expect(row?.netAmountCents).toBe(9000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- report-data`
Expected: FAIL with "Cannot find module './report-data'".

- [ ] **Step 3: Implement `report-data.ts`**

```ts
// apps/web/src/lib/billing/report-data.ts
import {
  type AppliedBillingFee,
  computeAmountCents,
  getStatusConfig,
} from "@/lib/billing/calculations";
import { groupBillingsByStatusSections } from "@/lib/billing/dashboard";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import { getBillings } from "@/services/billing";

export type ReportSectionKey = "atrasado" | "pendente" | "pago";

export type ReportInstallmentRow = {
  patientName: string;
  description: string;
  installmentLabel: string;
  dueDate: string;
  paidAt: string | null;
  grossAmountCents: number;
  netAmountCents: number;
};

export type ReportSection = {
  key: ReportSectionKey;
  label: string;
  rows: ReportInstallmentRow[];
  subtotalGrossCents: number;
  subtotalNetCents: number;
};

export type BillingReportData = {
  professionalName: string;
  month: string;
  monthLabel: string;
  generatedAt: string;
  sections: ReportSection[];
  totalGrossCents: number;
  totalNetCents: number;
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export async function getBillingReportData(params: {
  professionalId: string;
  professionalName: string;
  month: string;
}): Promise<BillingReportData> {
  const { professionalId, professionalName, month } = params;
  const { startDate, endDate } = getMonthRange(month);
  const { billings } = await getBillings(startDate, endDate);
  const groupedSections = groupBillingsByStatusSections(billings, month, null);

  const sections: ReportSection[] = groupedSections.map((section) => {
    const rows: ReportInstallmentRow[] = section.billings.flatMap((billing) =>
      billing.filteredInstallments.map((installment) => {
        const appliedFees = (installment.applied_installment_fees ??
          []) as unknown as AppliedBillingFee[];
        const { totalAmountCents, netAmountCents } = computeAmountCents(
          {
            amount: installment.amount,
            paid_amount: installment.paid_amount,
            splitted_installment: installment.splitted_installment as Record<
              string,
              number
            > | null,
          },
          appliedFees,
          professionalId,
        );

        return {
          patientName: billing.patient.name ?? "",
          description: billing.description ?? "",
          installmentLabel: `${installment.installment_number}/${billing.installment_count}`,
          dueDate: installment.due_date,
          paidAt: installment.paid_at,
          grossAmountCents: totalAmountCents,
          netAmountCents,
        };
      }),
    );

    const subtotalGrossCents = rows.reduce((sum, row) => sum + row.grossAmountCents, 0);
    const subtotalNetCents = rows.reduce((sum, row) => sum + row.netAmountCents, 0);

    return {
      key: section.key,
      label: getStatusConfig(section.key).label,
      rows,
      subtotalGrossCents,
      subtotalNetCents,
    };
  });

  return {
    professionalName,
    month,
    monthLabel: `${capitalize(dayjs(month).format("MMMM"))} de ${dayjs(month).format("YYYY")}`,
    generatedAt: dayjs().toISOString(),
    sections,
    totalGrossCents: sections.reduce((sum, s) => sum + s.subtotalGrossCents, 0),
    totalNetCents: sections.reduce((sum, s) => sum + s.subtotalNetCents, 0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- report-data`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/billing/report-data.ts apps/web/src/lib/billing/report-data.test.ts
git commit -m "feat(billing): add report data aggregation for export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: CSV generator (`report-csv.ts`)

**Files:**
- Create: `apps/web/src/lib/billing/report-csv.ts`
- Test: `apps/web/src/lib/billing/report-csv.test.ts`

**Interfaces:**
- Consumes: `BillingReportData` from `@/lib/billing/report-data` (Task 2); `formatCurrency` from `@/lib/billing/calculations`; `dayjs` from `@/lib/dayjs`.
- Produces: `buildBillingReportCsv(data: BillingReportData): Buffer`, `escapeCsvField(value: string): string` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/billing/report-csv.test.ts
import { describe, expect, it } from "vitest";
import type { BillingReportData } from "./report-data";
import { buildBillingReportCsv, escapeCsvField } from "./report-csv";

function makeReportData(overrides: Partial<BillingReportData> = {}): BillingReportData {
  return {
    professionalName: "Dra. Ana",
    month: "2026-09",
    monthLabel: "Setembro de 2026",
    generatedAt: "2026-09-08T12:00:00.000Z",
    sections: [
      { key: "atrasado", label: "Vencida", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      {
        key: "pendente",
        label: "A Receber",
        rows: [
          {
            patientName: "Maria, Silva",
            description: 'Pré-natal "completo"',
            installmentLabel: "1/3",
            dueDate: "2026-09-15",
            paidAt: null,
            grossAmountCents: 10000,
            netAmountCents: 9000,
          },
        ],
        subtotalGrossCents: 10000,
        subtotalNetCents: 9000,
      },
      { key: "pago", label: "Pago", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
    ],
    totalGrossCents: 10000,
    totalNetCents: 9000,
    ...overrides,
  };
}

describe("escapeCsvField", () => {
  it("wraps and escapes a field containing a comma and quotes", () => {
    expect(escapeCsvField('Maria, "Silva"')).toBe('"Maria, ""Silva"""');
  });

  it("leaves a plain field untouched", () => {
    expect(escapeCsvField("Pré-natal")).toBe("Pré-natal");
  });
});

describe("buildBillingReportCsv", () => {
  it("starts with a UTF-8 BOM followed directly by the header row", () => {
    const csv = buildBillingReportCsv(makeReportData()).toString("utf-8");
    expect(csv.startsWith("﻿Gestante,")).toBe(true);
  });

  it("contains only header + data rows, no title or subtotal lines", () => {
    const csv = buildBillingReportCsv(makeReportData()).toString("utf-8");
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "Gestante,Descrição,Parcela,Status,Data de Vencimento,Data de Pagamento,Valor Bruto,Valor Líquido",
    );
    expect(lines[1]).toContain('"Maria, Silva"');
    expect(lines[1]).toContain("A Receber");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- report-csv`
Expected: FAIL with "Cannot find module './report-csv'".

- [ ] **Step 3: Implement `report-csv.ts`**

```ts
// apps/web/src/lib/billing/report-csv.ts
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { BillingReportData } from "./report-data";

const CSV_BOM = "﻿";

const CSV_HEADERS = [
  "Gestante",
  "Descrição",
  "Parcela",
  "Status",
  "Data de Vencimento",
  "Data de Pagamento",
  "Valor Bruto",
  "Valor Líquido",
];

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildBillingReportCsv(data: BillingReportData): Buffer {
  const lines: string[] = [CSV_HEADERS.map(escapeCsvField).join(",")];

  for (const section of data.sections) {
    for (const row of section.rows) {
      lines.push(
        [
          row.patientName,
          row.description,
          row.installmentLabel,
          section.label,
          dayjs(row.dueDate).format("DD/MM/YYYY"),
          row.paidAt ? dayjs(row.paidAt).format("DD/MM/YYYY") : "",
          formatCurrency(row.grossAmountCents),
          formatCurrency(row.netAmountCents),
        ]
          .map((field) => escapeCsvField(field))
          .join(","),
      );
    }
  }

  return Buffer.from(CSV_BOM + lines.join("\r\n"), "utf-8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- report-csv`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/billing/report-csv.ts apps/web/src/lib/billing/report-csv.test.ts
git commit -m "feat(billing): add CSV generator for financial report export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Excel generator (`report-excel.ts`)

**Files:**
- Modify: `apps/web/package.json` (add `exceljs` dependency)
- Create: `apps/web/src/lib/billing/report-excel.ts`
- Test: `apps/web/src/lib/billing/report-excel.test.ts`

**Interfaces:**
- Consumes: `BillingReportData` from `@/lib/billing/report-data` (Task 2); `formatCurrency` from `@/lib/billing/calculations`; `dayjs` from `@/lib/dayjs`.
- Produces: `buildBillingReportExcel(data: BillingReportData): Promise<Buffer>` — consumed by Task 6.

- [ ] **Step 1: Add the `exceljs` dependency**

```bash
pnpm --filter web add exceljs
```

- [ ] **Step 2: Write the failing tests**

```ts
// apps/web/src/lib/billing/report-excel.test.ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { BillingReportData } from "./report-data";
import { buildBillingReportExcel } from "./report-excel";

function makeReportData(): BillingReportData {
  return {
    professionalName: "Dra. Ana",
    month: "2026-09",
    monthLabel: "Setembro de 2026",
    generatedAt: "2026-09-08T12:00:00.000Z",
    sections: [
      {
        key: "pendente",
        label: "A Receber",
        rows: [
          {
            patientName: "Maria Silva",
            description: "Pré-natal",
            installmentLabel: "1/3",
            dueDate: "2026-09-15",
            paidAt: null,
            grossAmountCents: 10000,
            netAmountCents: 9000,
          },
        ],
        subtotalGrossCents: 10000,
        subtotalNetCents: 9000,
      },
    ],
    totalGrossCents: 10000,
    totalNetCents: 9000,
  };
}

describe("buildBillingReportExcel", () => {
  it("writes the title row, header row, data row, subtotal and total", async () => {
    const buffer = await buildBillingReportExcel(makeReportData());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.getCell(1, 1).value).toBe("Ventre - Relatório Financeiro de SETEMBRO/2026");
    expect(sheet.getRow(3).values?.slice(1)).toEqual([
      "Gestante",
      "Descrição",
      "Parcela",
      "Status",
      "Data de Vencimento",
      "Data de Pagamento",
      "Valor Bruto",
      "Valor Líquido",
    ]);

    const dataRow = sheet.getRow(4).values as unknown[];
    expect(dataRow[1]).toBe("Maria Silva");
    expect(dataRow[4]).toBe("A Receber");

    const subtotalRow = sheet.getRow(5).values as unknown[];
    expect(subtotalRow[4]).toBe("Subtotal A Receber");

    const totalRow = sheet.getRow(6).values as unknown[];
    expect(totalRow[4]).toBe("Total Geral");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web test -- report-excel`
Expected: FAIL with "Cannot find module './report-excel'".

- [ ] **Step 4: Implement `report-excel.ts`**

```ts
// apps/web/src/lib/billing/report-excel.ts
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import ExcelJS from "exceljs";
import type { BillingReportData } from "./report-data";

const COLUMN_HEADERS = [
  "Gestante",
  "Descrição",
  "Parcela",
  "Status",
  "Data de Vencimento",
  "Data de Pagamento",
  "Valor Bruto",
  "Valor Líquido",
];

export async function buildBillingReportExcel(data: BillingReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Relatório Financeiro");
  sheet.columns = COLUMN_HEADERS.map(() => ({ width: 20 }));

  const monthUpper = dayjs(data.month).format("MMMM").toUpperCase();
  const year = dayjs(data.month).format("YYYY");
  sheet.mergeCells(1, 1, 1, COLUMN_HEADERS.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Ventre - Relatório Financeiro de ${monthUpper}/${year}`;
  titleCell.font = { bold: true, size: 14 };

  const HEADER_ROW = 3;
  sheet.getRow(HEADER_ROW).values = COLUMN_HEADERS;
  sheet.getRow(HEADER_ROW).font = { bold: true };

  let currentRow = HEADER_ROW + 1;

  for (const section of data.sections) {
    if (section.rows.length === 0) continue;

    for (const row of section.rows) {
      sheet.getRow(currentRow).values = [
        row.patientName,
        row.description,
        row.installmentLabel,
        section.label,
        dayjs(row.dueDate).format("DD/MM/YYYY"),
        row.paidAt ? dayjs(row.paidAt).format("DD/MM/YYYY") : "",
        formatCurrency(row.grossAmountCents),
        formatCurrency(row.netAmountCents),
      ];
      currentRow++;
    }

    sheet.getRow(currentRow).values = [
      "",
      "",
      "",
      `Subtotal ${section.label}`,
      "",
      "",
      formatCurrency(section.subtotalGrossCents),
      formatCurrency(section.subtotalNetCents),
    ];
    sheet.getRow(currentRow).font = { bold: true };
    currentRow++;
  }

  sheet.getRow(currentRow).values = [
    "",
    "",
    "",
    "Total Geral",
    "",
    "",
    formatCurrency(data.totalGrossCents),
    formatCurrency(data.totalNetCents),
  ];
  sheet.getRow(currentRow).font = { bold: true };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test -- report-excel`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/billing/report-excel.ts apps/web/src/lib/billing/report-excel.test.ts
git commit -m "feat(billing): add Excel generator for financial report export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: PDF document and buffer renderer

**Files:**
- Create: `apps/web/src/components/shared/billing-report-pdf-document.tsx`
- Create: `apps/web/src/lib/billing/report-pdf.ts`
- Test: `apps/web/src/lib/billing/report-pdf.test.ts`

**Interfaces:**
- Consumes: `BillingReportData` from `@/lib/billing/report-data` (Task 2); `formatCurrency` from `@/lib/billing/calculations`; `PDF_FONT_FAMILY` from `@/lib/contract-pdf-fonts`; `dayjs` from `@/lib/dayjs`.
- Produces: `renderBillingReportPdfBuffer(data: BillingReportData): Promise<Buffer>` — consumed by Task 6.

- [ ] **Step 1: Write the failing test (smoke test — content correctness is covered by Task 2's data tests)**

```ts
// apps/web/src/lib/billing/report-pdf.test.ts
import { describe, expect, it } from "vitest";
import type { BillingReportData } from "./report-data";
import { renderBillingReportPdfBuffer } from "./report-pdf";

function makeReportData(overrides: Partial<BillingReportData> = {}): BillingReportData {
  return {
    professionalName: "Dra. Ana",
    month: "2026-09",
    monthLabel: "Setembro de 2026",
    generatedAt: "2026-09-08T12:00:00.000Z",
    sections: [
      { key: "atrasado", label: "Vencida", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pendente", label: "A Receber", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pago", label: "Pago", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
    ],
    totalGrossCents: 0,
    totalNetCents: 0,
    ...overrides,
  };
}

describe("renderBillingReportPdfBuffer", () => {
  it("renders a non-empty PDF buffer for an empty month", async () => {
    const buffer = await renderBillingReportPdfBuffer(makeReportData());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("renders a non-empty PDF buffer with populated sections", async () => {
    const buffer = await renderBillingReportPdfBuffer(
      makeReportData({
        sections: [
          {
            key: "pendente",
            label: "A Receber",
            rows: [
              {
                patientName: "Maria Silva",
                description: "Pré-natal",
                installmentLabel: "1/3",
                dueDate: "2026-09-15",
                paidAt: null,
                grossAmountCents: 10000,
                netAmountCents: 9000,
              },
            ],
            subtotalGrossCents: 10000,
            subtotalNetCents: 9000,
          },
        ],
        totalGrossCents: 10000,
        totalNetCents: 9000,
      }),
    );
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- report-pdf`
Expected: FAIL with "Cannot find module './report-pdf'".

- [ ] **Step 3: Implement the PDF document component**

```tsx
// apps/web/src/components/shared/billing-report-pdf-document.tsx
import path from "node:path";
import { formatCurrency } from "@/lib/billing/calculations";
import type { BillingReportData } from "@/lib/billing/report-data";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
  },
  header: { marginBottom: 16, paddingBottom: 12, borderBottom: "1 solid #e5e7eb" },
  logo: { width: 100, height: 27, marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  headerLabel: { fontSize: 8, color: "#6b7280" },
  headerValue: { fontSize: 10, fontWeight: "bold" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1 solid #d1d5db",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #f3f4f6", paddingVertical: 4 },
  colPatient: { width: "20%" },
  colDescription: { width: "19%" },
  colInstallment: { width: "8%" },
  colDueDate: { width: "13%" },
  colPaidDate: { width: "13%" },
  colGross: { width: "13.5%", textAlign: "right" },
  colNet: { width: "13.5%", textAlign: "right" },
  headerCellText: { fontSize: 7, fontWeight: "bold", color: "#6b7280" },
  cellText: { fontSize: 8 },
  cellTextBold: { fontSize: 8, fontWeight: "bold" },
  subtotalRow: { flexDirection: "row", paddingVertical: 4, borderTop: "1 solid #d1d5db" },
  subtotalLabel: {
    fontSize: 8,
    fontWeight: "bold",
    width: "60%",
    textAlign: "right",
    paddingRight: 8,
  },
  totalSection: { marginTop: 16, paddingTop: 8, borderTop: "1 solid #111827" },
});

function TableHeader() {
  return (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.headerCellText, styles.colPatient]}>Gestante</Text>
      <Text style={[styles.headerCellText, styles.colDescription]}>Descrição</Text>
      <Text style={[styles.headerCellText, styles.colInstallment]}>Parcela</Text>
      <Text style={[styles.headerCellText, styles.colDueDate]}>Vencimento</Text>
      <Text style={[styles.headerCellText, styles.colPaidDate]}>Pagamento</Text>
      <Text style={[styles.headerCellText, styles.colGross]}>Bruto</Text>
      <Text style={[styles.headerCellText, styles.colNet]}>Líquido</Text>
    </View>
  );
}

export function BillingReportPdfDocument({ data }: { data: BillingReportData }) {
  const visibleSections = data.sections.filter((section) => section.rows.length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={path.join(process.cwd(), "src/assets/ventre.png")} style={styles.logo} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerLabel}>Profissional</Text>
              <Text style={styles.headerValue}>{data.professionalName}</Text>
            </View>
            <View>
              <Text style={styles.headerLabel}>Mês de referência</Text>
              <Text style={styles.headerValue}>{data.monthLabel}</Text>
            </View>
            <View>
              <Text style={styles.headerLabel}>Gerado em</Text>
              <Text style={styles.headerValue}>
                {dayjs(data.generatedAt).format("DD/MM/YYYY [às] HH:mm")}
              </Text>
            </View>
          </View>
        </View>

        {visibleSections.length === 0 ? (
          <Text style={styles.cellText}>Nenhuma cobrança encontrada neste mês.</Text>
        ) : (
          visibleSections.map((section) => (
            <View key={section.key}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <TableHeader />
              {section.rows.map((row, index) => (
                <View key={`${section.key}-${index}`} style={styles.tableRow}>
                  <Text style={[styles.cellText, styles.colPatient]}>{row.patientName}</Text>
                  <Text style={[styles.cellText, styles.colDescription]}>{row.description}</Text>
                  <Text style={[styles.cellText, styles.colInstallment]}>
                    {row.installmentLabel}
                  </Text>
                  <Text style={[styles.cellText, styles.colDueDate]}>
                    {dayjs(row.dueDate).format("DD/MM/YYYY")}
                  </Text>
                  <Text style={[styles.cellText, styles.colPaidDate]}>
                    {row.paidAt ? dayjs(row.paidAt).format("DD/MM/YYYY") : "-"}
                  </Text>
                  <Text style={[styles.cellText, styles.colGross]}>
                    {formatCurrency(row.grossAmountCents)}
                  </Text>
                  <Text style={[styles.cellText, styles.colNet]}>
                    {formatCurrency(row.netAmountCents)}
                  </Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal {section.label}</Text>
                <Text style={[styles.cellTextBold, styles.colGross]}>
                  {formatCurrency(section.subtotalGrossCents)}
                </Text>
                <Text style={[styles.cellTextBold, styles.colNet]}>
                  {formatCurrency(section.subtotalNetCents)}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.totalSection}>
          <View style={styles.tableRow}>
            <Text style={styles.subtotalLabel}>Total Geral</Text>
            <Text style={[styles.cellTextBold, styles.colGross]}>
              {formatCurrency(data.totalGrossCents)}
            </Text>
            <Text style={[styles.cellTextBold, styles.colNet]}>
              {formatCurrency(data.totalNetCents)}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Implement the buffer renderer**

```ts
// apps/web/src/lib/billing/report-pdf.ts
import { BillingReportPdfDocument } from "@/components/shared/billing-report-pdf-document";
import type { BillingReportData } from "@/lib/billing/report-data";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.
export async function renderBillingReportPdfBuffer(data: BillingReportData): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(BillingReportPdfDocument, { data }) as React.ReactElement<DocumentProps>,
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test -- report-pdf`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shared/billing-report-pdf-document.tsx apps/web/src/lib/billing/report-pdf.ts apps/web/src/lib/billing/report-pdf.test.ts
git commit -m "feat(billing): add PDF generator for financial report export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `exportBillingReportAction`

**Files:**
- Create: `apps/web/src/actions/export-billing-report-action.ts`
- Test: `apps/web/src/actions/export-billing-report-action.test.ts`

**Interfaces:**
- Consumes: `getBillingReportData` (Task 2, mocked in tests), `renderBillingReportPdfBuffer` (Task 5), `buildBillingReportExcel` (Task 4), `buildBillingReportCsv` (Task 3); `authActionClient` from `@/lib/safe-action`.
- Produces: `exportBillingReportAction` — a `next-safe-action` action taking `{ month: string; format: "pdf" | "xlsx" | "csv" }` and resolving to `{ fileBase64: string; fileName: string; mimeType: string }` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/actions/export-billing-report-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, reportData } = vi.hoisted(() => ({
  authUser: { id: "prof-1" },
  profileRow: {
    data: { id: "prof-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: { data: null as { enterprise_id: string } | null, error: null as { message: string } | null },
  reportData: {
    professionalName: "Dra. Ana",
    month: "2026-09",
    monthLabel: "Setembro de 2026",
    generatedAt: "2026-09-08T12:00:00.000Z",
    sections: [
      { key: "atrasado", label: "Vencida", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pendente", label: "A Receber", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pago", label: "Pago", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
    ],
    totalGrossCents: 0,
    totalNetCents: 0,
  },
}));

function makeSingleQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeSingleQueryBuilder(profileRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeSingleQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/billing/report-data", () => ({
  getBillingReportData: vi.fn(async () => reportData),
}));

import { exportBillingReportAction } from "./export-billing-report-action";

describe("exportBillingReportAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
  });

  it("returns a PDF buffer with the right file name and mime type", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "pdf" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.pdf");
    expect(res?.data?.mimeType).toBe("application/pdf");
    const buffer = Buffer.from(res?.data?.fileBase64 ?? "", "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("returns an Excel buffer with the right file name and mime type", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "xlsx" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.xlsx");
    expect(res?.data?.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res?.data?.fileBase64.length).toBeGreaterThan(0);
  });

  it("returns a CSV buffer containing only the header row for an empty month", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "csv" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.csv");
    expect(res?.data?.mimeType).toBe("text/csv;charset=utf-8");
    const csv = Buffer.from(res?.data?.fileBase64 ?? "", "base64").toString("utf-8");
    expect(csv.replace(/^﻿/, "").trim()).toBe(
      "Gestante,Descrição,Parcela,Status,Data de Vencimento,Data de Pagamento,Valor Bruto,Valor Líquido",
    );
  });

  it("rejects an invalid format", async () => {
    // @ts-expect-error - intentionally invalid input for the test
    const res = await exportBillingReportAction({ month: "2026-09", format: "doc" });
    expect(res?.data).toBeUndefined();
    expect(res?.validationErrors).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- export-billing-report-action`
Expected: FAIL with "Cannot find module './export-billing-report-action'".

- [ ] **Step 3: Implement the action**

```ts
// apps/web/src/actions/export-billing-report-action.ts
"use server";

import { getBillingReportData } from "@/lib/billing/report-data";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["pdf", "xlsx", "csv"]),
});

const MIME_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
} as const;

export const exportBillingReportAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput: { month, format }, ctx: { user, profile } }) => {
    const data = await getBillingReportData({
      professionalId: user.id,
      professionalName: profile.name,
      month,
    });

    let buffer: Buffer;
    if (format === "pdf") {
      const { renderBillingReportPdfBuffer } = await import("@/lib/billing/report-pdf");
      buffer = await renderBillingReportPdfBuffer(data);
    } else if (format === "xlsx") {
      const { buildBillingReportExcel } = await import("@/lib/billing/report-excel");
      buffer = await buildBillingReportExcel(data);
    } else {
      const { buildBillingReportCsv } = await import("@/lib/billing/report-csv");
      buffer = buildBillingReportCsv(data);
    }

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `relatorio-financeiro-${month}.${format}`,
      mimeType: MIME_TYPES[format],
    };
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- export-billing-report-action`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/export-billing-report-action.ts apps/web/src/actions/export-billing-report-action.test.ts
git commit -m "feat(billing): add export-billing-report-action dispatching PDF/Excel/CSV

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Export modal (`export-billing-report-modal.tsx`)

**Files:**
- Create: `apps/web/src/modals/export-billing-report-modal.tsx`

**Interfaces:**
- Consumes: `exportBillingReportAction` (Task 6); `ContentModal` from `@ventre/ui/shared/content-modal`; `Button` from `@ventre/ui/button`; `dayjs` from `@/lib/dayjs`.
- Produces: `ExportBillingReportModal` component and `ExportFormat = "pdf" | "xlsx" | "csv"` type, consumed by Task 8.

No new automated test: this component is a thin, purely presentational wrapper around an already-tested action and an already-tested shared modal primitive (`ContentModal`), matching how `NewBillingModal` (same directory) has no dedicated test file. It's covered by the manual verification in Task 8.

- [ ] **Step 1: Implement the modal**

```tsx
// apps/web/src/modals/export-billing-report-modal.tsx
"use client";

import { exportBillingReportAction } from "@/actions/export-billing-report-action";
import { dayjs } from "@/lib/dayjs";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type ExportFormat = "pdf" | "xlsx" | "csv";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

type ExportBillingReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: ExportFormat | null;
  defaultMonth: string;
};

export function ExportBillingReportModal({
  open,
  onOpenChange,
  format,
  defaultMonth,
}: ExportBillingReportModalProps) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  useEffect(() => {
    if (open) setSelectedMonth(defaultMonth);
  }, [open, defaultMonth]);

  const { execute, isPending } = useAction(exportBillingReportAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      const byteChars = atob(data.fileBase64);
      const byteNumbers = Array.from(byteChars, (c) => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      link.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Não foi possível gerar o relatório. Tente novamente.");
    },
  });

  if (!format) return null;

  const monthLabel = `${capitalize(dayjs(selectedMonth).format("MMMM"))} de ${dayjs(selectedMonth).format("YYYY")}`;

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Exportar relatório em ${FORMAT_LABELS[format]}`}
      description="Escolha o mês do relatório financeiro."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setSelectedMonth(dayjs(selectedMonth).subtract(1, "month").format("YYYY-MM"))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center font-medium">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMonth(dayjs(selectedMonth).add(1, "month").format("YYYY-MM"))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          className="w-full"
          onClick={() => execute({ month: selectedMonth, format })}
          disabled={isPending}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Exportar
        </Button>
      </div>
    </ContentModal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types --filter=web`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modals/export-billing-report-modal.tsx
git commit -m "feat(billing): add export report modal with month picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the export button-group into `billing-dashboard-screen.tsx`

**Files:**
- Modify: `apps/web/src/screens/billing-dashboard-screen.tsx`

**Interfaces:**
- Consumes: `ButtonGroup`, `ButtonGroupSeparator` from `@ventre/ui/button-group` (Task 1); `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@ventre/ui/dropdown-menu`; `ExportBillingReportModal`, `ExportFormat` from `@/modals/export-billing-report-modal` (Task 7).

- [ ] **Step 1: Add the imports**

In `apps/web/src/screens/billing-dashboard-screen.tsx`, add alongside the existing imports:

```ts
import { ExportBillingReportModal, type ExportFormat } from "@/modals/export-billing-report-modal";
import { ButtonGroup, ButtonGroupSeparator } from "@ventre/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ventre/ui/dropdown-menu";
import { ChevronDown, Download } from "lucide-react";
```

(`Plus` and `Receipt` are already imported from `lucide-react` on line 25 — extend that same import instead of duplicating it.)

- [ ] **Step 2: Add export state**

Right after the existing `const [showNewBillingModal, setShowNewBillingModal] = useState(false);` (line 93):

```ts
const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
const [showExportModal, setShowExportModal] = useState(false);

const handleExport = useCallback((format: ExportFormat) => {
  setExportFormat(format);
  setShowExportModal(true);
}, []);
```

- [ ] **Step 3: Add the button-group to the header actions**

Replace the header actions block (lines 106-114):

```tsx
<div className="flex items-center justify-between gap-2">
  <div />
  <div className="flex items-center gap-2">
    <ButtonGroup>
      <Button size="sm" variant="outline" onClick={() => handleExport("pdf")}>
        <Download className="mr-1 h-4 w-4" />
        Exportar em PDF
      </Button>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="px-2">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("xlsx")}>
            Exportar para Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            Exportar para CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
    <Button size="sm" className="gradient-primary" onClick={handleOpenNewBilling}>
      <Plus className="mr-1 h-4 w-4" />
      Nova Cobrança
    </Button>
  </div>
</div>
```

- [ ] **Step 4: Render the modal**

Right after the closing `</NewBillingModal>`'s parent `<NewBillingModal ... />` block (end of the component, before the final closing `</>`), add:

```tsx
<ExportBillingReportModal
  open={showExportModal}
  onOpenChange={setShowExportModal}
  format={exportFormat}
  defaultMonth={activeMonthForHook}
/>
```

- [ ] **Step 5: Type-check**

Run: `pnpm check-types --filter=web`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/billing-dashboard-screen.tsx
git commit -m "feat(billing): wire report export button-group into billing dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the billing dashboard**

Start `apps/web` and navigate to `/financeiro` (or the current billing dashboard route) logged in as a professional with at least one billing in the current month.

- [ ] **Step 2: Verify the button-group renders correctly**

Confirm "Exportar em PDF" + chevron button render side by side, connected (no double border/gap), and that the chevron opens a dropdown with "Exportar para Excel" and "Exportar para CSV".

- [ ] **Step 3: Verify each of the 3 export paths**

For each of PDF, Excel, and CSV: click the option, confirm the modal opens pre-filled with the currently selected month, change the month with the chevrons, click "Exportar", and confirm a file downloads with the name `relatorio-financeiro-<mês>.<ext>`.

- [ ] **Step 4: Open each downloaded file**

- PDF: opens correctly, shows the Ventre logo, professional name, month, generation date, gray divider, sections with subtotals and a grand total.
- Excel: opens in Excel/Google Sheets, first row reads "Ventre - Relatório Financeiro de \<MÊS\>/\<ANO\>", data and subtotal/total rows present.
- CSV: opens/imports cleanly (e.g. in Google Sheets' "Import" flow), only header + data rows, accented characters (ã, ç, é) render correctly (BOM working).

- [ ] **Step 5: Verify the empty-month case**

Navigate to a month with no billings, export any format, confirm it downloads a report with empty sections / zeroed totals instead of erroring.

- [ ] **Step 6: Verify mobile layout**

Resize to a mobile viewport, confirm the export modal renders as a bottom Sheet (not a centered Dialog), and the button-group doesn't overflow the header.

- [ ] **Step 7: Run the full test suite and type-check**

Run: `pnpm test && pnpm check-types`
Expected: all green.
