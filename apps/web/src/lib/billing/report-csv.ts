import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import { formatSaoPauloDateTime } from "./report-data";
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
          row.paidAt ? formatSaoPauloDateTime(row.paidAt, "DD/MM/YYYY") : "",
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
