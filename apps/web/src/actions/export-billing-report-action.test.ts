import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, reportData } = vi.hoisted(() => ({
  authUser: { id: "prof-1" },
  profileRow: {
    data: { id: "prof-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  reportData: {
    professionalName: "Dra. Ana",
    month: "2026-09",
    monthLabel: "Setembro de 2026",
    generatedAt: "2026-09-08T12:00:00.000Z",
    sections: [
      { key: "atrasado", label: "Vencida", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pendente", label: "A Receber", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
      { key: "pago", label: "Pago", rows: [], subtotalGrossCents: 0, subtotalNetCents: 0 },
    ],
    totalGrossCents: 0,
    totalNetCents: 0,
  },
}));

function makeSingleQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeSingleQueryBuilder(profileRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeSingleQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/billing/report-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/report-data")>();
  return {
    ...actual,
    getBillingReportData: vi.fn(async () => reportData),
  };
});

import { exportBillingReportAction } from "./export-billing-report-action";

describe("exportBillingReportAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
  });

  it("returns a PDF buffer with the right file name and mime type", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "pdf" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.pdf");
    expect(res?.data?.mimeType).toBe("application/pdf");
    const buffer = Buffer.from(res?.data?.fileBase64 ?? "", "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("returns an Excel buffer with the right file name and mime type", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "xlsx" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.xlsx");
    expect(res?.data?.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res?.data?.fileBase64.length).toBeGreaterThan(0);
  });

  it("returns a CSV buffer containing only the header row for an empty month", async () => {
    const res = await exportBillingReportAction({ month: "2026-09", format: "csv" });
    expect(res?.data?.fileName).toBe("relatorio-financeiro-2026-09.csv");
    expect(res?.data?.mimeType).toBe("text/csv;charset=utf-8");
    const csv = Buffer.from(res?.data?.fileBase64 ?? "", "base64").toString("utf-8");
    expect(csv.replace(/^﻿/, "").trim()).toBe(
      "Gestante,Descrição,Parcela,Status,Data de Vencimento,Data de Pagamento,Valor Bruto,Descontos,Valor Líquido",
    );
  });

  it("rejects an invalid format", async () => {
    // @ts-expect-error - intentionally invalid input for the test
    const res = await exportBillingReportAction({ month: "2026-09", format: "doc" });
    expect(res?.data).toBeUndefined();
    expect(res?.validationErrors).toBeTruthy();
  });
});
