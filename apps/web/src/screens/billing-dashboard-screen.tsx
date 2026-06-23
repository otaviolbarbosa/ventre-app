"use client";

import { getPatientsAction } from "@/actions/get-patients-action";
import { BillingGroupCard } from "@/components/billing/billing-group-card";
import { BillingGroupCardExpanded } from "@/components/billing/billing-group-card-expanded";
import { BillingViewSwitcher } from "@/components/billing/billing-view-switcher";
import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { PeriodFilterDropdown } from "@/components/billing/period-filter-dropdown";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useBillingDashboard } from "@/hooks/use-billing-dashboard";
import { useBillingViewMode } from "@/hooks/use-billing-view-mode";
import type { BillingPeriod } from "@/lib/billing/period-range";
import NewBillingModal from "@/modals/new-billing-modal";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Plus, Receipt, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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
  const { user } = useAuth();
  const { viewMode, setViewMode } = useBillingViewMode();

  const {
    activeFilter,
    handleFilterClick,
    filteredBillings,
    billingMetrics,
    activePeriodLabel,
    sectionTitle,
  } = useBillingDashboard({ billings, metrics, activePeriod });

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

  const [showNewBillingModal, setShowNewBillingModal] = useState(false);
  const { execute: fetchPatients, result: patientsResult } = useAction(getPatientsAction);

  const handleOpenNewBilling = useCallback(() => {
    if (!patientsResult.data) fetchPatients();
    setShowNewBillingModal(true);
  }, [fetchPatients, patientsResult.data]);

  return (
    <>
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
            <div className="flex items-center gap-2">
              <PeriodFilterDropdown activePeriod={activePeriod} onSelect={handlePeriodSelect} />
              <Button size="sm" className="gradient-primary" onClick={handleOpenNewBilling}>
                <Plus className="mr-1 h-4 w-4" />
                Nova Cobrança
              </Button>
            </div>
          </div>

          {metrics && (
            <DashboardMetrics
              metrics={billingMetrics}
              activeFilter={activeFilter}
              onFilterClick={handleFilterClick}
            />
          )}

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-lg">{sectionTitle}</h2>
              <BillingViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
            {filteredBillings.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhuma cobrança"
                description={
                  activeFilter
                    ? "Nenhuma cobrança encontrada para este filtro."
                    : "Suas cobranças aparecerão aqui."
                }
              />
            ) : viewMode === "expanded" ? (
              <div className="flex flex-col gap-3">
                {filteredBillings.map((billing) => (
                  <BillingGroupCardExpanded
                    key={billing.id}
                    billing={billing}
                    installments={billing.filteredInstallments}
                    professionalId={user?.id as string}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredBillings.map((billing) => (
                  <BillingGroupCard
                    key={billing.id}
                    billing={billing}
                    installments={billing.filteredInstallments}
                    professionalId={user?.id as string}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewBillingModal
        patients={patientsResult.data?.patients?.map((p) => ({ id: p.id, name: p.name })) ?? []}
        showModal={showNewBillingModal}
        setShowModal={setShowNewBillingModal}
        callback={() => router.refresh()}
      />
    </>
  );
}
