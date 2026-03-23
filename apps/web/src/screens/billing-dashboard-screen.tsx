"use client";

import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { InstallmentCard } from "@/components/billing/installment-card";
import { PeriodFilterDropdown } from "@/components/billing/period-filter-dropdown";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBillingDashboard } from "@/hooks/use-billing-dashboard";
import type { BillingPeriod } from "@/lib/billing/period-range";
import type { BillingWithInstallments, DashboardMetrics as DashboardMetricsType } from "@/services/billing";
import { Receipt, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

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

  const { activeFilter, handleFilterClick, filteredInstallments, billingMetrics, activePeriodLabel, sectionTitle } =
    useBillingDashboard({ billings, metrics, activePeriod });

  const handlePeriodSelect = useCallback(
    (period: BillingPeriod) => {
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

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-4 p-4 pt-0 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <Badge variant="outline">{activePeriodLabel ?? ""}</Badge>
            {activePeriod && (
              <Button variant="ghost" size="icon-sm" onClick={handleClearPeriod}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <PeriodFilterDropdown activePeriod={activePeriod} onSelect={handlePeriodSelect} />
        </div>

        {metrics && (
          <DashboardMetrics
            metrics={billingMetrics}
            activeFilter={activeFilter}
            onFilterClick={handleFilterClick}
          />
        )}

        <div>
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
