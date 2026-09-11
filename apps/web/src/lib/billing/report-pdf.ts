import { BillingReportPdfDocument } from "@/components/shared/billing-report-pdf-document";
import type { BillingReportData } from "@/lib/billing/report-data";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.
export async function renderBillingReportPdfBuffer(data: BillingReportData): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(BillingReportPdfDocument, { data }) as React.ReactElement<DocumentProps>,
  );
}
