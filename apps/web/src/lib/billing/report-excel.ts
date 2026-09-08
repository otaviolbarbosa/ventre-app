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
