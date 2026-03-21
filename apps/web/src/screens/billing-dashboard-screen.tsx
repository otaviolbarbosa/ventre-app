"use client";

import {
  DashboardMetrics,
  type FilterKey,
  type MetricItem,
} from "@/components/billing/dashboard-metrics";
import { InstallmentCard } from "@/components/billing/installment-card";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BillingPeriod } from "@/lib/billing/period-range";
import { cn } from "@/lib/utils";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import type { Tables } from "@nascere/supabase/types";
import { AlertTriangle, Check, Clock, ListFilter, Receipt, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type Installment = Tables<"installments"> & {
  description: string;
  patient_name: string;
  patient_id: string;
  billing_installment_count: number;
};

type PeriodOption = {
  key: BillingPeriod;
  label: string;
};

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "last_week", label: "Última semana" },
  { key: "last_month", label: "Último mês" },
  { key: "last_quarter", label: "Último trimestre" },
  { key: "next_week", label: "Próxima semana" },
  { key: "next_month", label: "Próximo mês" },
  { key: "next_quarter", label: "Próximo trimestre" },
];

const FILTER_LABELS: Record<FilterKey, string> = {
  total: "Total a Receber",
  paid: "Recebido",
  overdue: "Em Atraso",
  upcoming: "Próximos Vencimentos",
};

type BillingDashboardScreenProps = {
  billings: BillingWithInstallments[];
  metrics: DashboardMetricsType | null;
  activePeriod: BillingPeriod | null;
};

export default function BillingDashboardScreen({
  billings,
  metrics,
  activePeriod,
}: BillingDashboardScreenProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [showPeriodFilter, setShowPeriodFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLHeadingElement>(null);

  const billingMetrics = [
    {
      key: "paid",
      title: "Recebido",
      amount: metrics?.paid_amount ?? 0,
      icon: TrendingUp,
    },
    {
      key: "upcoming",
      title: "Próx. Vencimentos",
      amount: metrics?.upcoming_due ?? 0,
      icon: Clock,
    },
    {
      key: "overdue",
      title: "Em Atraso",
      amount: metrics?.overdue_amount ?? 0,
      icon: AlertTriangle,
    },
  ] satisfies MetricItem[];

  const handlePeriodSelect = useCallback(
    (period: BillingPeriod) => {
      setShowPeriodFilter(false);
      if (activePeriod === period) {
        router.push("/billing");
      } else {
        router.push(`/billing?period=${period}`);
      }
    },
    [activePeriod, router],
  );

  const handleClearPeriod = useCallback(() => {
    router.push("/billing");
  }, [router]);

  const handleFilterClick = useCallback((filter: FilterKey) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }, []);

  const filteredInstallments = (() => {
    const installments = billings.flatMap((billing) =>
      billing.installments.map((installment) => ({
        ...installment,
        patient_name: billing.patient.name,
        description: billing.description,
        patient_id: billing.patient_id,
        billing_installment_count: billing.installments.length,
      })),
    );

    if (!activeFilter) return installments;

    return installments.filter((installment) => {
      switch (activeFilter) {
        // case "total":
        //   return (
        //     installment.paid_amount < installment.amount && installment.status !== "cancelado"
        //   );
        case "paid":
          return installment.status === "pago";
        case "overdue":
          return installment.status === "atrasado";
        case "upcoming":
          return installment.status === "pendente";
        default:
          return true;
      }
    });
  })() as Installment[];

  const activePeriodLabel = PERIOD_OPTIONS.find((o) => o.key === activePeriod)?.label;
  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : "Cobranças Recentes";

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-4 p-4 pt-0 md:p-6 ">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <Badge variant="outline">{activePeriodLabel ?? ""}</Badge>

            {activePeriod && (
              <Button variant="ghost" size="icon-sm" onClick={handleClearPeriod}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div ref={filterRef} className="relative">
            <Button
              size="icon"
              variant={activePeriod ? "secondary" : "outline"}
              onClick={() => setShowPeriodFilter((prev) => !prev)}
              className="gap-2"
            >
              <ListFilter className="h-4 w-4" />
            </Button>

            <div
              className={cn(
                "absolute top-full right-0 z-10 mt-2 flex min-w-48 flex-col gap-1 rounded-xl border bg-background p-2 shadow-md transition-opacity duration-200",
                showPeriodFilter ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handlePeriodSelect(option.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    activePeriod === option.key && "font-medium text-primary",
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      activePeriod === option.key ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {metrics && (
          <DashboardMetrics
            metrics={billingMetrics}
            activeFilter={activeFilter}
            onFilterClick={handleFilterClick}
          />
        )}

        <div ref={sectionRef}>
          <h2 className="mb-3 font-semibold text-lg">{sectionTitle}</h2>
          {filteredInstallments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma cobrança"
              description={
                activeFilter
                  ? "Nenhuma cobrança encontrada para este filtro."
                  : "Suas cobranças aparecerão aqui."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredInstallments.map((installment) => (
                <InstallmentCard
                  key={installment.id}
                  installment={installment}
                  installmentCount={installment.billing_installment_count}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
