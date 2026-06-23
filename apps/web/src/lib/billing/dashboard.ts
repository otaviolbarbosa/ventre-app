import type { FilterKey, MetricItem } from "@/components/billing/dashboard-metrics";
import type { BillingPeriod } from "@/lib/billing/period-range";
import type { BillingWithInstallments, DashboardMetrics } from "@/services/billing";
import type { Json, Tables } from "@ventre/supabase/types";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlatInstallment = Tables<"installments"> & {
  description: string;
  patient_name: string;
  patient_id: string;
  billing_installment_count: number;
  applied_billing_fees: Json;
};

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

export const FILTER_LABELS: Record<FilterKey, string> = {
  total: "Total a Receber",
  paid: "Recebido",
  overdue: "Em Atraso",
  upcoming: "Próximos Vencimentos",
};

// ─── Pure functions ───────────────────────────────────────────────────────────

export function flattenInstallments(billings: BillingWithInstallments[]): FlatInstallment[] {
  return billings.flatMap((billing) =>
    billing.installments.map((installment) => ({
      ...installment,
      patient_name: billing.patient.name,
      description: billing.description,
      patient_id: billing.patient_id,
      billing_installment_count: billing.installments.length,
      applied_billing_fees: billing.applied_billing_fees,
    })),
  );
}

function matchesFilter(installment: Tables<"installments">, filter: FilterKey | null): boolean {
  if (!filter) return true;
  switch (filter) {
    case "paid":
      return installment.status === "pago";
    case "overdue":
      return installment.status === "atrasado";
    case "upcoming":
      return installment.status === "pendente";
    default:
      return true;
  }
}

export function filterInstallments(
  installments: FlatInstallment[],
  filter: FilterKey | null,
): FlatInstallment[] {
  return installments.filter((i) => matchesFilter(i, filter));
}

export function groupBillingsByFilter(
  billings: BillingWithInstallments[],
  filter: FilterKey | null,
): GroupedBilling[] {
  return billings
    .map((billing) => ({
      ...billing,
      filteredInstallments: billing.installments.filter((i) => matchesFilter(i, filter)),
    }))
    .filter((billing) => billing.filteredInstallments.length > 0);
}

export function buildBillingMetrics(metrics: DashboardMetrics): MetricItem[] {
  return [
    { key: "paid", title: "Recebido", amount: metrics.paid_amount, icon: TrendingUp },
    { key: "upcoming", title: "A receber", amount: metrics.upcoming_due, icon: Clock },
    { key: "overdue", title: "Em Atraso", amount: metrics.overdue_amount, icon: AlertTriangle },
  ] satisfies MetricItem[];
}
