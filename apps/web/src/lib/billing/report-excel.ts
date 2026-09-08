import { dayjs } from "@/lib/dayjs";
import ExcelJS from "exceljs";
import { formatSaoPauloDateTime } from "./report-data";
import type { BillingReportData } from "./report-data";

const CURRENCY_NUM_FMT = '"R$" #,##0.00';
const GROSS_COLUMN = 7;
const NET_COLUMN = 8;

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
        row.paidAt ? formatSaoPauloDateTime(row.paidAt, "DD/MM/YYYY") : "",
        row.grossAmountCents / 100,
        row.netAmountCents / 100,
      ];
      sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
      sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;
      currentRow++;
    }

    sheet.getRow(currentRow).values = [
      "",
      "",
      "",
      `Subtotal ${section.label}`,
      "",
      "",
      section.subtotalGrossCents / 100,
      section.subtotalNetCents / 100,
    ];
    sheet.getRow(currentRow).font = { bold: true };
    sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
    sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;
    currentRow++;
  }

  sheet.getRow(currentRow).values = [
    "",
    "",
    "",
    "Total Geral",
    "",
    "",
    data.totalGrossCents / 100,
    data.totalNetCents / 100,
  ];
  sheet.getRow(currentRow).font = { bold: true };
  sheet.getCell(currentRow, GROSS_COLUMN).numFmt = CURRENCY_NUM_FMT;
  sheet.getCell(currentRow, NET_COLUMN).numFmt = CURRENCY_NUM_FMT;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
