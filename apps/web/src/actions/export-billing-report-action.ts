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
