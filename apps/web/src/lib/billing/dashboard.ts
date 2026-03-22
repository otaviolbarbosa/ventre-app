import type { FilterKey, MetricItem } from "@/components/billing/dashboard-metrics";
import type { BillingPeriod } from "@/lib/billing/period-range";
import type { BillingWithInstallments, DashboardMetrics } from "@/services/billing";
import type { Tables } from "@nascere/supabase/types";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlatInstallment = Tables<"installments"> & {
  description: string;
  patient_name: string;
  patient_id: string;
  billing_installment_count: number;
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
    })),
  );
}

export function filterInstallments(
  installments: FlatInstallment[],
  filter: FilterKey | null,
): FlatInstallment[] {
  if (!filter) return installments;
  return installments.filter((i) => {
    switch (filter) {
      case "paid":
        return i.status === "pago";
      case "overdue":
        return i.status === "atrasado";
      case "upcoming":
        return i.status === "pendente";
      default:
        return true;
    }
  });
}

export function buildBillingMetrics(metrics: DashboardMetrics): MetricItem[] {
  return [
    { key: "paid", title: "Recebido", amount: metrics.paid_amount, icon: TrendingUp },
    { key: "upcoming", title: "Próx. Vencimentos", amount: metrics.upcoming_due, icon: Clock },
    { key: "overdue", title: "Em Atraso", amount: metrics.overdue_amount, icon: AlertTriangle },
  ] satisfies MetricItem[];
}
