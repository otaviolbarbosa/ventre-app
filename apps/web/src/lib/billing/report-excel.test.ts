import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { BillingReportData } from "./report-data";
import { buildBillingReportExcel } from "./report-excel";

const CURRENCY_NUM_FMT = '"R$" #,##0.00';

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

  it("skips sections with empty rows (no stray subtotal rows)", async () => {
    const data: BillingReportData = {
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
        {
          key: "atrasado",
          label: "Vencida",
          rows: [],
          subtotalGrossCents: 0,
          subtotalNetCents: 0,
        },
      ],
      totalGrossCents: 10000,
      totalNetCents: 9000,
    };

    const buffer = await buildBillingReportExcel(data);
    const workbook = new ExcelJS.Workbook();
    // biome-ignore lint/suspicious/noExplicitAny: ExcelJS types are loose
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) throw new Error("No worksheet found");

    // Row 4: data row for Maria Silva
    const dataRowValues = sheet.getRow(4).values;
    const dataRow = Array.isArray(dataRowValues) ? dataRowValues : [];
    expect(dataRow[1]).toBe("Maria Silva");

    // Row 5: subtotal for "A Receber" section
    const subtotalRowValues = sheet.getRow(5).values;
    const subtotalRow = Array.isArray(subtotalRowValues) ? subtotalRowValues : [];
    expect(subtotalRow[4]).toBe("Subtotal A Receber");

    // Row 6: grand total (no row 5.5 or intermediate "Subtotal Vencida")
    const totalRowValues = sheet.getRow(6).values;
    const totalRow = Array.isArray(totalRowValues) ? totalRowValues : [];
    expect(totalRow[4]).toBe("Total Geral");

    // Verify no "Subtotal Vencida" exists anywhere
    let foundVencidaSubtotal = false;
    for (let i = 1; i <= 20; i++) {
      const row = sheet.getRow(i).values;
      if (Array.isArray(row) && row.includes("Subtotal Vencida")) {
        foundVencidaSubtotal = true;
      }
    }
    expect(foundVencidaSubtotal).toBe(false);
  });

  it("handles multiple non-empty sections with correct row stacking", async () => {
    const data: BillingReportData = {
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
            {
              patientName: "João Santos",
              description: "Parto",
              installmentLabel: "1/1",
              dueDate: "2026-09-20",
              paidAt: null,
              grossAmountCents: 50000,
              netAmountCents: 45000,
            },
          ],
          subtotalGrossCents: 60000,
          subtotalNetCents: 54000,
        },
        {
          key: "atrasado",
          label: "Vencida",
          rows: [
            {
              patientName: "Ana Costa",
              description: "Consulta",
              installmentLabel: "2/3",
              dueDate: "2026-08-20",
              paidAt: null,
              grossAmountCents: 20000,
              netAmountCents: 18000,
            },
          ],
          subtotalGrossCents: 20000,
          subtotalNetCents: 18000,
        },
      ],
      totalGrossCents: 80000,
      totalNetCents: 72000,
    };

    const buffer = await buildBillingReportExcel(data);
    const workbook = new ExcelJS.Workbook();
    // biome-ignore lint/suspicious/noExplicitAny: ExcelJS types are loose
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) throw new Error("No worksheet found");

    // Helper to safely extract row values as array
    const getRowAsArray = (rowNum: number) => {
      const values = sheet.getRow(rowNum).values;
      // biome-ignore lint/suspicious/noExplicitAny: ExcelJS row.values type is loose
      return Array.isArray(values) ? (values as any[]) : [];
    };

    // Row 4: first data row (Maria Silva, A Receber section)
    const row4 = getRowAsArray(4);
    expect(row4[1]).toBe("Maria Silva");
    expect(row4[4]).toBe("A Receber");

    // Row 5: second data row (João Santos, A Receber section)
    const row5 = getRowAsArray(5);
    expect(row5[1]).toBe("João Santos");
    expect(row5[4]).toBe("A Receber");

    // Row 6: subtotal for A Receber
    const row6 = getRowAsArray(6);
    expect(row6[4]).toBe("Subtotal A Receber");

    // Row 7: first data row of Vencida section (Ana Costa)
    const row7 = getRowAsArray(7);
    expect(row7[1]).toBe("Ana Costa");
    expect(row7[4]).toBe("Vencida");

    // Row 8: subtotal for Vencida
    const row8 = getRowAsArray(8);
    expect(row8[4]).toBe("Subtotal Vencida");

    // Row 9: grand total
    const row9 = getRowAsArray(9);
    expect(row9[4]).toBe("Total Geral");
  });

  it("writes Valor Bruto and Valor Líquido as numeric cells with a currency numFmt", async () => {
    const buffer = await buildBillingReportExcel(makeReportData());
    const workbook = new ExcelJS.Workbook();
    // biome-ignore lint/suspicious/noExplicitAny: ExcelJS types are loose
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) throw new Error("No worksheet found");

    // Helper to safely extract row values as array
    const getRowAsArray = (rowNum: number) => {
      const values = sheet.getRow(rowNum).values;
      // biome-ignore lint/suspicious/noExplicitAny: ExcelJS row.values type is loose
      return Array.isArray(values) ? (values as any[]) : [];
    };

    // Column 7 (index 7) = Valor Bruto, Column 8 (index 8) = Valor Líquido
    const grossAmountCents = 10000;
    const netAmountCents = 9000;
    const expectedGross = grossAmountCents / 100;
    const expectedNet = netAmountCents / 100;

    // Row 4: data row with numeric currency values
    const dataRow = getRowAsArray(4);
    expect(dataRow[7]).toBe(expectedGross);
    expect(dataRow[8]).toBe(expectedNet);
    expect(sheet.getCell(4, 7).numFmt).toBe(CURRENCY_NUM_FMT);
    expect(sheet.getCell(4, 8).numFmt).toBe(CURRENCY_NUM_FMT);

    // Row 5: subtotal row with numeric currency values
    const subtotalRow = getRowAsArray(5);
    expect(subtotalRow[7]).toBe(expectedGross);
    expect(subtotalRow[8]).toBe(expectedNet);
    expect(sheet.getCell(5, 7).numFmt).toBe(CURRENCY_NUM_FMT);
    expect(sheet.getCell(5, 8).numFmt).toBe(CURRENCY_NUM_FMT);

    // Row 6: grand total with numeric currency values
    const totalRow = getRowAsArray(6);
    expect(totalRow[7]).toBe(expectedGross);
    expect(totalRow[8]).toBe(expectedNet);
    expect(sheet.getCell(6, 7).numFmt).toBe(CURRENCY_NUM_FMT);
    expect(sheet.getCell(6, 8).numFmt).toBe(CURRENCY_NUM_FMT);
  });

  it("formats a paidAt near a UTC day boundary using the São Paulo-local date", async () => {
    const data = makeReportData();
    const row = data.sections[0]?.rows[0];
    if (!row) throw new Error("Expected a row in fixture data");
    // 01:30 UTC is 22:30 the previous day in São Paulo (UTC-3).
    row.paidAt = "2026-09-16T01:30:00.000Z";

    const buffer = await buildBillingReportExcel(data);
    const workbook = new ExcelJS.Workbook();
    // biome-ignore lint/suspicious/noExplicitAny: ExcelJS types are loose
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("No worksheet found");

    const dataRowValues = sheet.getRow(4).values;
    const dataRow = Array.isArray(dataRowValues) ? dataRowValues : [];
    expect(dataRow[6]).toBe("15/09/2026");
  });
});
