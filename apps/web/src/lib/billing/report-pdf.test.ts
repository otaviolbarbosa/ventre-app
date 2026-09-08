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
