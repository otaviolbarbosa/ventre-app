import type { FilterKey, MetricItem } from "@/components/billing/dashboard-metrics";
import type { BillingPeriod } from "@/lib/billing/period-range";
import { getMonthRange } from "@/lib/billing/period-range";
import type { BillingWithInstallments, DashboardMetrics } from "@/services/billing";
import type { Tables } from "@ventre/supabase/types";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GroupedBilling = BillingWithInstallments & {
  filteredInstallments: Tables<"installments">[];
};

export type PeriodOption = {
  key: BillingPeriod;
  label: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "last_week", label: "Última semana" },
  { key: "last_month", label: "Último mês" },
  { key: "last_quarter", label: "Último trimestre" },
  { key: "next_week", label: "Próxima semana" },
  { key: "next_month", label: "Próximo mês" },
  { key: "next_quarter", label: "Próximo trimestre" },
];

// ─── Pure functions ───────────────────────────────────────────────────────────

type InstallmentStatusSection = "atrasado" | "pendente" | "pago";

export type StatusSection = {
  key: InstallmentStatusSection;
  label: string;
  billings: GroupedBilling[];
};

const STATUS_SECTIONS: { key: InstallmentStatusSection; label: string }[] = [
  { key: "atrasado", label: "Em Atraso" },
  { key: "pendente", label: "Pendente" },
  { key: "pago", label: "Pago" },
];

const FILTER_TO_STATUS: Partial<Record<FilterKey, InstallmentStatusSection>> = {
  paid: "pago",
  overdue: "atrasado",
  upcoming: "pendente",
};

function matchesStatusSection(
  installment: Tables<"installments">,
  status: InstallmentStatusSection,
  monthRange: { startDate: string; endDate: string },
): boolean {
  if (installment.status !== status) return false;

  if (status === "pago") {
    return (
      !!installment.paid_at &&
      installment.paid_at >= monthRange.startDate &&
      installment.paid_at <= monthRange.endDate
    );
  }

  return (
    installment.due_date >= monthRange.startDate && installment.due_date <= monthRange.endDate
  );
}

export function groupBillingsByStatusSections(
  billings: BillingWithInstallments[],
  activeMonth: string,
  filter: FilterKey | null,
): StatusSection[] {
  const monthRange = getMonthRange(activeMonth);
  const targetStatus = filter ? FILTER_TO_STATUS[filter] : undefined;

  return STATUS_SECTIONS.filter((section) => !targetStatus || section.key === targetStatus).map(
    (section) => ({
      key: section.key,
      label: section.label,
      billings: billings
        .map((billing) => ({
          ...billing,
          filteredInstallments: billing.installments.filter((i) =>
            matchesStatusSection(i, section.key, monthRange),
          ),
        }))
        .filter((billing) => billing.filteredInstallments.length > 0),
    }),
  );
}

export function buildBillingMetrics(metrics: DashboardMetrics): MetricItem[] {
  return [
    { key: "paid", title: "Recebido", amount: metrics.paid_amount, icon: TrendingUp },
    { key: "upcoming", title: "A receber", amount: metrics.upcoming_due, icon: Clock },
    { key: "overdue", title: "Em Atraso", amount: metrics.overdue_amount, icon: AlertTriangle },
  ] satisfies MetricItem[];
}
