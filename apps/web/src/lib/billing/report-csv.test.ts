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
