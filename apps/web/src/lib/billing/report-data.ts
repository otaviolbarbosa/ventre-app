import {
  type AppliedBillingFee,
  computeAmountCents,
  getStatusConfig,
} from "@/lib/billing/calculations";
import { groupBillingsByStatusSections } from "@/lib/billing/dashboard";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import { getBillings } from "@/services/billing";
import utc from "dayjs/plugin/utc";

// `.utcOffset(minutes)` as a setter (vs. the getter-only core API) requires the `utc` plugin.
// `dayjs` is a shared global singleton (see @/lib/dayjs), and `dayjs.extend` is idempotent
// (no-ops if a plugin is already installed), so extending it here is safe and does not change
// the default (no-offset-call) formatting behavior used elsewhere in the app.
dayjs.extend(utc);

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

// Report generators run server-side, where Vercel's process clock is UTC. The on-screen
// billing dashboard formats timestamps client-side in the professional's own (Brazil) local
// timezone, so a server-side `dayjs(iso).format(...)` would show a different calendar date
// than what the professional sees on screen (e.g. a 21:00 BRT payment stored as 00:00 UTC the
// next day). Brazil has had no DST since 2019, so a fixed -03:00 offset is safe — same pattern
// as SAO_PAULO_UTC_OFFSET_HOURS in partograph-overlay-svg.ts and combineDateAndTime's
// hardcoded "-03:00". Only apply this to real timestamps (timestamptz columns) — never to a
// plain `date` column like `due_date`, which has no time component to convert.
const SAO_PAULO_UTC_OFFSET_MINUTES = -180;

export function formatSaoPauloDateTime(iso: string, pattern: string): string {
  return dayjs(iso).utcOffset(SAO_PAULO_UTC_OFFSET_MINUTES).format(pattern);
}

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
