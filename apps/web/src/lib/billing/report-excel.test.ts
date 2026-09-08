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
    // biome-ignore lint/suspicious/noExplicitAny: ExcelJS types are loose
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) throw new Error("No worksheet found");

    expect(sheet.getCell(1, 1).value).toBe("Ventre - Relatório Financeiro de SETEMBRO/2026");
    const headerValues = sheet.getRow(3).values;
    expect(Array.isArray(headerValues) ? headerValues.slice(1) : []).toEqual([
      "Gestante",
      "Descrição",
      "Parcela",
      "Status",
      "Data de Vencimento",
      "Data de Pagamento",
      "Valor Bruto",
      "Valor Líquido",
    ]);

    const dataRowValues = sheet.getRow(4).values;
    const dataRow = Array.isArray(dataRowValues) ? dataRowValues : [];
    expect(dataRow[1]).toBe("Maria Silva");
    expect(dataRow[4]).toBe("A Receber");

    const subtotalRowValues = sheet.getRow(5).values;
    const subtotalRow = Array.isArray(subtotalRowValues) ? subtotalRowValues : [];
    expect(subtotalRow[4]).toBe("Subtotal A Receber");

    const totalRowValues = sheet.getRow(6).values;
    const totalRow = Array.isArray(totalRowValues) ? totalRowValues : [];
    expect(totalRow[4]).toBe("Total Geral");
  });
});
