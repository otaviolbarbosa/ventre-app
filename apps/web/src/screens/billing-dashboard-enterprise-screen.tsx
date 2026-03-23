"use client";

import { getEnterpriseBillingAction as fetchEnterpriseBilling } from "@/actions/get-enterprise-billing-action";
import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { InstallmentCard } from "@/components/billing/installment-card";
import { PeriodFilterDropdown } from "@/components/billing/period-filter-dropdown";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingDashboard } from "@/hooks/use-billing-dashboard";
import type { BillingPeriod } from "@/lib/billing/period-range";
import { getPeriodRange } from "@/lib/billing/period-range";
import type { EnterpriseBillingProfessional } from "@/services/billing";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import { Receipt, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useState } from "react";

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
  const [professionalFilter, setProfessionalFilter] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod | null>(activePeriod);

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

  const handlePeriodSelect = (selectedPeriod: BillingPeriod) => {
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

  const { activeFilter, handleFilterClick, filteredInstallments, billingMetrics, activePeriodLabel, sectionTitle } =
    useBillingDashboard({ billings, metrics, activePeriod: period });

  const professionalsMap = Object.fromEntries(
    professionals.map((p) => [p.id, p.name ?? p.id]),
  );

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
            <PeriodFilterDropdown activePeriod={period} onSelect={handlePeriodSelect} />
          </div>

          {/* Metrics */}
          {metrics && (
            <DashboardMetrics
              metrics={billingMetrics}
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
