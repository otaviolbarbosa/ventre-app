"use client";

import { getBillingDashboardAction } from "@/actions/get-billing-dashboard-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { BillingGroupCard } from "@/components/billing/billing-group-card";
import { BillingGroupCardExpanded } from "@/components/billing/billing-group-card-expanded";
import { BillingViewSwitcher } from "@/components/billing/billing-view-switcher";
import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useBillingDashboard } from "@/hooks/use-billing-dashboard";
import { useBillingViewMode } from "@/hooks/use-billing-view-mode";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import NewBillingModal from "@/modals/new-billing-modal";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import { Button } from "@ventre/ui/button";
import { Plus, Receipt } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useState } from "react";

type BillingDashboardScreenProps = {
  billings: BillingWithInstallments[];
  metrics: DashboardMetricsType | null;
  activeMonth: string;
};

export default function BillingDashboardScreen({
  billings: initialBillings,
  metrics: initialMetrics,
  activeMonth: initialActiveMonth,
}: BillingDashboardScreenProps) {
  const { user } = useAuth();
  const { viewMode, setViewMode } = useBillingViewMode();
  const [currentMonth, setCurrentMonth] = useState<string | null>(initialActiveMonth);

  const { execute, result } = useAction(getBillingDashboardAction);

  const billings: BillingWithInstallments[] =
    (result.data?.billings as BillingWithInstallments[] | undefined) ?? initialBillings;
  const metrics: DashboardMetricsType | null =
    (result.data?.metrics as DashboardMetricsType | null | undefined) ?? initialMetrics;

  const fetchData = useCallback(
    (month: string | null) => {
      const dateRange = month ? getMonthRange(month) : undefined;
      execute({
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
    },
    [execute],
  );

  const handleMonthChange = (month: string | null) => {
    setCurrentMonth(month);
    fetchData(month);
  };

  const activeMonthForHook = currentMonth ?? dayjs().format("YYYY-MM");

  const {
    activeFilter,
    handleFilterClick,
    filteredBillings,
    billingMetrics,
    activeMonthLabel,
    sectionTitle,
  } = useBillingDashboard({ billings, metrics, activeMonth: activeMonthForHook });

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
            <div />
            <div className="flex items-center gap-2">
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
              activeMonth={activeMonthForHook}
              activeMonthLabel={activeMonthLabel}
              onMonthChange={handleMonthChange}
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
        callback={() => fetchData(currentMonth)}
      />
    </>
  );
}
