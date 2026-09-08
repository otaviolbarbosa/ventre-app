import { beforeEach, describe, expect, it, vi } from "vitest";

const { billingsResult } = vi.hoisted(() => ({
  billingsResult: { billings: [] as unknown[] },
}));

vi.mock("@/services/billing", () => ({
  getBillings: vi.fn(async () => billingsResult),
}));

import { getBillingReportData } from "./report-data";

function makeInstallment(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    installment_number: 1,
    amount: 10000,
    paid_amount: 0,
    status: "pendente",
    due_date: "2026-09-15",
    paid_at: null,
    splitted_installment: { "prof-1": 10000 },
    applied_installment_fees: [],
    ...overrides,
  };
}

function makeBilling(overrides: Record<string, unknown> = {}) {
  return {
    id: "billing-1",
    description: "Pré-natal",
    installment_count: 1,
    patient: { id: "patient-1", name: "Maria Silva" },
    installments: [makeInstallment()],
    ...overrides,
  };
}

describe("getBillingReportData", () => {
  beforeEach(() => {
    billingsResult.billings = [];
  });

  it("returns zeroed totals and empty rows when there are no billings", async () => {
    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    expect(result.totalGrossCents).toBe(0);
    expect(result.totalNetCents).toBe(0);
    expect(result.sections).toHaveLength(3);
    expect(result.sections.every((s) => s.rows.length === 0)).toBe(true);
  });

  it("groups a pending installment under the correct section with gross === net when there are no fees", async () => {
    billingsResult.billings = [makeBilling()];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const pendente = result.sections.find((s) => s.key === "pendente");
    expect(pendente?.rows).toHaveLength(1);
    expect(pendente?.rows[0]).toMatchObject({
      patientName: "Maria Silva",
      description: "Pré-natal",
      installmentLabel: "1/1",
      grossAmountCents: 10000,
      netAmountCents: 10000,
    });
    expect(pendente?.subtotalGrossCents).toBe(10000);
    expect(result.totalGrossCents).toBe(10000);
  });

  it("only reflects the requested professional's share of a split installment", async () => {
    billingsResult.billings = [
      makeBilling({
        installments: [
          makeInstallment({
            amount: 20000,
            splitted_installment: { "prof-1": 12000, "prof-2": 8000 },
          }),
        ],
      }),
    ];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const row = result.sections.find((s) => s.key === "pendente")?.rows[0];
    expect(row?.grossAmountCents).toBe(12000);
  });

  it("subtracts applied fees to compute the net amount", async () => {
    billingsResult.billings = [
      makeBilling({
        installments: [
          makeInstallment({
            applied_installment_fees: [
              {
                professional_id: "prof-1",
                fee_id: "fee-1",
                name: "Taxa da clínica",
                fee_type: "percentage",
                value: 10,
                base_amount_cents: 10000,
                computed_amount_cents: 1000,
              },
            ],
          }),
        ],
      }),
    ];

    const result = await getBillingReportData({
      professionalId: "prof-1",
      professionalName: "Dra. Ana",
      month: "2026-09",
    });

    const row = result.sections.find((s) => s.key === "pendente")?.rows[0];
    expect(row?.grossAmountCents).toBe(10000);
    expect(row?.netAmountCents).toBe(9000);
  });
});
