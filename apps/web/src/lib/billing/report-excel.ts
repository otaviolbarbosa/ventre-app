import { dayjs } from "@/lib/dayjs";
import ExcelJS from "exceljs";
import { formatSaoPauloDateTime } from "./report-data";
import type { BillingReportData } from "./report-data";

const CURRENCY_NUM_FMT = '"R$" #,##0.00';
const GROSS_COLUMN = 7;
const DISCOUNTS_COLUMN = 8;
const NET_COLUMN = 9;

const COLUMN_HEADERS = [
  "Gestante",
  "Descrição",
  "Parcela",
  "Status",
  "Data de Vencimento",
  "Data de Pagamento",
  "Valor Bruto",
  "Descontos",
  "Valor Líquido",
];

function sumDiscountCents(rows: BillingReportData["sections"][number]["rows"]): number {
  return rows.reduce(
    (sum, row) =>
      sum + row.discounts.reduce((rowSum, discount) => rowSum + discount.amountCents, 0),
    0,
  );
}

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

  sheet.mergeCells(2, 1, 2, COLUMN_HEADERS.length);
  const professionalCell = sheet.getCell(2, 1);
  professionalCell.value = `Profissional: ${data.professionalName}`;
  professionalCell.font = { size: 11 };

  const HEADER_ROW = 3;
  sheet.getRow(HEADER_ROW).values = COLUMN_HEADERS;
  sheet.getRow(HEADER_ROW).font = { bold: true };

  let currentRow = HEADER_ROW + 1;

  for (const section of data.sections) {
    if (section.rows.length === 0) continue;

    for (const row of section.rows) {
      const discountCents = sumDiscountCents([row]);
      sheet.getRow(currentRow).values = [
        row.patientName,
        row.description,
        row.installmentLabel,
        section.label,
        dayjs(row.dueDate).format("DD/MM/YYYY"),
        row.paidAt ? formatSaoPauloDateTime(row.paidAt, "DD/MM/YYYY") : "",
        row.grossAmountCents / 100,
        discountCents > 0 ? -discountCents / 100 : 0,
        row.netAmountCents / 100,
      ];
      sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
      sheet.getCell(currentRow, DISCOUNTS_COLUMN).numFmt = CURRENCY_NUM_FMT;
      sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;
      currentRow++;
    }

    const sectionDiscountCents = sumDiscountCents(section.rows);
    sheet.getRow(currentRow).values = [
      "",
      "",
      "",
      `Subtotal ${section.label}`,
      "",
      "",
      section.subtotalGrossCents / 100,
      sectionDiscountCents > 0 ? -sectionDiscountCents / 100 : 0,
      section.subtotalNetCents / 100,
    ];
    sheet.getRow(currentRow).font = { bold: true };
    sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
    sheet.getCell(currentRow, DISCOUNTS_COLUMN).numFmt = CURRENCY_NUM_FMT;
    sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;
    currentRow++;
  }

  const totalDiscountCents = sumDiscountCents(data.sections.flatMap((section) => section.rows));
  sheet.getRow(currentRow).values = [
    "",
    "",
    "",
    "Total Geral",
    "",
    "",
    data.totalGrossCents / 100,
    totalDiscountCents > 0 ? -totalDiscountCents / 100 : 0,
    data.totalNetCents / 100,
  ];
  sheet.getRow(currentRow).font = { bold: true };
  sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
  sheet.getCell(currentRow, DISCOUNTS_COLUMN).numFmt = CURRENCY_NUM_FMT;
  sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
