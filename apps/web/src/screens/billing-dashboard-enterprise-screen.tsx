"use client";

import { getEnterpriseBillingAction as fetchEnterpriseBilling } from "@/actions/get-enterprise-billing-action";
import {
  DashboardMetrics,
  type FilterKey,
  type MetricItem,
} from "@/components/billing/dashboard-metrics";
import { InstallmentCard } from "@/components/billing/installment-card";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BillingPeriod } from "@/lib/billing/period-range";
import { getPeriodRange } from "@/lib/billing/period-range";
import { cn } from "@/lib/utils";
import type { EnterpriseBillingProfessional } from "@/services/billing";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import type { Tables } from "@nascere/supabase/types";
import { AlertTriangle, Check, Clock, ListFilter, Receipt, TrendingUp, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

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

type BillingDashboardEnterpriseScreenProps = {
  initialBillings: BillingWithInstallments[];
  initialMetrics: DashboardMetricsType | null;
  initialProfessionals: EnterpriseBillingProfessional[];
  activePeriod: BillingPeriod | null;
};

export default function BillingDashboardEnterpriseScreen({
  initialBillings,
  initialMetrics,
  initialProfessionals,
  activePeriod,
}: BillingDashboardEnterpriseScreenProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [showPeriodFilter, setShowPeriodFilter] = useState(false);
  const [professionalFilter, setProfessionalFilter] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod | null>(activePeriod);

  const filterRef = useRef<HTMLDivElement>(null);

  const { execute, result, isPending } = useAction(fetchEnterpriseBilling);

  const billings: BillingWithInstallments[] =
    (result.data?.billings as BillingWithInstallments[] | undefined) ?? initialBillings;
  const metrics: DashboardMetricsType | null =
    (result.data?.metrics as DashboardMetricsType | null | undefined) ?? initialMetrics;
  const professionals: EnterpriseBillingProfessional[] =
    result.data?.professionals ?? initialProfessionals;

  const fetchData = useCallback(
    (profId: string | null, currentPeriod: BillingPeriod | null) => {
      const dateRange = currentPeriod ? getPeriodRange(currentPeriod) : undefined;
      execute({
        professionalId: profId ?? undefined,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
    },
    [execute],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowPeriodFilter(false);
      }
    }
    if (showPeriodFilter) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPeriodFilter]);

  const handlePeriodSelect = (selectedPeriod: BillingPeriod) => {
    setShowPeriodFilter(false);
    const newPeriod = period === selectedPeriod ? null : selectedPeriod;
    setPeriod(newPeriod);
    fetchData(professionalFilter, newPeriod);
  };

  const handleClearPeriod = () => {
    setPeriod(null);
    fetchData(professionalFilter, null);
  };

  const handleProfessionalClick = (id: string) => {
    const isSame = professionalFilter === id;
    const newFilter = isSame ? null : id;
    setProfessionalFilter(newFilter);
    fetchData(newFilter, period);
  };

  const handleFilterClick = useCallback((filter: FilterKey) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }, []);

  const professionalsMap = Object.fromEntries(
    professionals.map((p) => [p.id, p.name ?? p.id]),
  );

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

  const activePeriodLabel = PERIOD_OPTIONS.find((o) => o.key === period)?.label;
  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : "Cobranças Recentes";

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-6 pb-28 sm:pb-4">
        {/* Professionals */}
        {professionals.length > 0 && (
          <div className="px-4 md:px-6">
            <ProfessionalsSelector
              professionals={professionals}
              selectedId={professionalFilter}
              onSelect={handleProfessionalClick}
              getCountLabel={(prof) =>
                prof.billing_count === 1 ? "1 cobrança" : `${prof.billing_count} cobranças`
              }
            />
          </div>
        )}

        <div className="space-y-4 px-4 md:px-6">
          {/* Period + professional filters bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {period && (
                <Badge variant="outline" className="gap-1">
                  {activePeriodLabel}
                  <button type="button" onClick={handleClearPeriod}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div ref={filterRef} className="relative">
              <Button
                size="icon"
                variant={period ? "secondary" : "outline"}
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
                      period === option.key && "font-medium text-primary",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        period === option.key ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics */}
          {metrics && (
            <DashboardMetrics
              metrics={
                [
                  {
                    key: "paid",
                    title: "Recebido",
                    amount: metrics.paid_amount,
                    icon: TrendingUp,
                  },
                  {
                    key: "upcoming",
                    title: "Próx. Vencimentos",
                    amount: metrics.upcoming_due,
                    icon: Clock,
                  },
                  {
                    key: "overdue",
                    title: "Em Atraso",
                    amount: metrics.overdue_amount,
                    icon: AlertTriangle,
                  },
                ] satisfies MetricItem[]
              }
              activeFilter={activeFilter}
              onFilterClick={handleFilterClick}
            />
          )}

          {/* Installments list */}
          <div>
            <h2 className="mb-3 font-semibold text-lg">{sectionTitle}</h2>
            {isPending ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {[0, 1, 2, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredInstallments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhuma cobrança"
                description={
                  activeFilter
                    ? "Nenhuma cobrança encontrada para este filtro."
                    : "As cobranças dos profissionais aparecerão aqui."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredInstallments.map((installment) => (
                  <InstallmentCard
                    key={installment.id}
                    installment={installment}
                    installmentCount={installment.billing_installment_count}
                    professionals={professionalsMap}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
