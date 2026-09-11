import { formatCurrency } from "@/lib/billing/calculations";
import { describe, expect, it } from "vitest";
import { buildBillingReportCsv, escapeCsvField } from "./report-csv";
import type { BillingReportData } from "./report-data";

const csvCurrency = (cents: number) => escapeCsvField(formatCurrency(cents));

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
            discounts: [],
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
      "Gestante,Descrição,Parcela,Status,Data de Vencimento,Data de Pagamento,Valor Bruto,Descontos,Valor Líquido",
    );
    expect(lines[1]).toContain('"Maria, Silva"');
    expect(lines[1]).toContain("A Receber");
  });

  it("leaves the Descontos field blank when a row has no discounts", () => {
    const csv = buildBillingReportCsv(makeReportData()).toString("utf-8");
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    // Valor Bruto and Valor Líquido are quoted (they contain a comma from the pt-BR decimal
    // separator), so an empty Descontos field between them shows up as back-to-back commas:
    // ..."<bruto>",,"<líquido>"...
    expect(lines[1]).toContain(`${csvCurrency(10000)},,${csvCurrency(9000)}`);
  });

  it("condenses multiple discounts into a single negative currency value", () => {
    const data = makeReportData();
    const row = data.sections[1]?.rows[0];
    if (!row) throw new Error("Expected a row in fixture data");
    row.discounts = [
      {
        fee_id: "fee-1",
        name: "INSS",
        fee_type: "fixed",
        value: 9999,
        amountCents: 9999,
      },
      {
        fee_id: "fee-2",
        name: "Taxa de serviço",
        fee_type: "percentage",
        value: 1,
        amountCents: 100,
      },
    ];

    const csv = buildBillingReportCsv(data).toString("utf-8");
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    // Total discount: 9999 + 100 = 10099 cents.
    expect(lines[1]).toContain(formatCurrency(-10099));
  });
});
