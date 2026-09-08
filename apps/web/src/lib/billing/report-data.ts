import {
  type AppliedBillingFee,
  computeAmountCents,
  getStatusConfig,
} from "@/lib/billing/calculations";
import { groupBillingsByStatusSections } from "@/lib/billing/dashboard";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import { getBillings } from "@/services/billing";

export type ReportSectionKey = "atrasado" | "pendente" | "pago";

export type ReportInstallmentRow = {
  patientName: string;
  description: string;
  installmentLabel: string;
  dueDate: string;
  paidAt: string | null;
  grossAmountCents: number;
  netAmountCents: number;
};

export type ReportSection = {
  key: ReportSectionKey;
  label: string;
  rows: ReportInstallmentRow[];
  subtotalGrossCents: number;
  subtotalNetCents: number;
};

export type BillingReportData = {
  professionalName: string;
  month: string;
  monthLabel: string;
  generatedAt: string;
  sections: ReportSection[];
  totalGrossCents: number;
  totalNetCents: number;
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export async function getBillingReportData(params: {
  professionalId: string;
  professionalName: string;
  month: string;
}): Promise<BillingReportData> {
  const { professionalId, professionalName, month } = params;
  const { startDate, endDate } = getMonthRange(month);
  const { billings } = await getBillings(startDate, endDate);
  const groupedSections = groupBillingsByStatusSections(billings, month, null);

  const sections: ReportSection[] = groupedSections.map((section) => {
    const rows: ReportInstallmentRow[] = section.billings.flatMap((billing) =>
      billing.filteredInstallments.map((installment) => {
        const appliedFees = (installment.applied_installment_fees ??
          []) as unknown as AppliedBillingFee[];
        const { totalAmountCents, netAmountCents } = computeAmountCents(
          {
            amount: installment.amount,
            paid_amount: installment.paid_amount,
            splitted_installment: installment.splitted_installment as Record<
              string,
              number
            > | null,
          },
          appliedFees,
          professionalId,
        );

        return {
          patientName: billing.patient.name ?? "",
          description: billing.description ?? "",
          installmentLabel: `${installment.installment_number}/${billing.installment_count}`,
          dueDate: installment.due_date,
          paidAt: installment.paid_at,
          grossAmountCents: totalAmountCents,
          netAmountCents,
        };
      }),
    );

    const subtotalGrossCents = rows.reduce((sum, row) => sum + row.grossAmountCents, 0);
    const subtotalNetCents = rows.reduce((sum, row) => sum + row.netAmountCents, 0);

    return {
      key: section.key,
      label: getStatusConfig(section.key).label,
      rows,
      subtotalGrossCents,
      subtotalNetCents,
    };
  });

  return {
    professionalName,
    month,
    monthLabel: `${capitalize(dayjs(month).format("MMMM"))} de ${dayjs(month).format("YYYY")}`,
    generatedAt: dayjs().toISOString(),
    sections,
    totalGrossCents: sections.reduce((sum, s) => sum + s.subtotalGrossCents, 0),
    totalNetCents: sections.reduce((sum, s) => sum + s.subtotalNetCents, 0),
  };
}
