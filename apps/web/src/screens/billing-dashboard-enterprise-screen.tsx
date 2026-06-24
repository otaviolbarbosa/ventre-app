"use client";

import { getEnterpriseBillingAction as fetchEnterpriseBilling } from "@/actions/get-enterprise-billing-action";
import { getEnterprisePatientsForBillingAction } from "@/actions/get-enterprise-patients-for-billing-action";
import { BillingGroupCard } from "@/components/billing/billing-group-card";
import { BillingGroupCardExpanded } from "@/components/billing/billing-group-card-expanded";
import { BillingTable } from "@/components/billing/billing-table";
import { BillingViewSwitcher } from "@/components/billing/billing-view-switcher";
import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { useBillingDashboard } from "@/hooks/use-billing-dashboard";
import { useBillingViewMode } from "@/hooks/use-billing-view-mode";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import NewBillingModal from "@/modals/new-billing-modal";
import type { EnterpriseBillingProfessional } from "@/services/billing";
import type {
  BillingWithInstallments,
  DashboardMetrics as DashboardMetricsType,
} from "@/services/billing";
import { Button } from "@ventre/ui/button";
import { Skeleton } from "@ventre/ui/skeleton";
import { Plus, Receipt } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useState } from "react";

type BillingDashboardEnterpriseScreenProps = {
  initialBillings: BillingWithInstallments[];
  initialMetrics: DashboardMetricsType | null;
  initialProfessionals: EnterpriseBillingProfessional[];
  activeMonth: string;
};

export default function BillingDashboardEnterpriseScreen({
  initialBillings,
  initialMetrics,
  initialProfessionals,
  activeMonth: initialActiveMonth,
}: BillingDashboardEnterpriseScreenProps) {
  const [professionalFilter, setProfessionalFilter] = useState<string | null>(null);
  const { viewMode, setViewMode } = useBillingViewMode();
  const [currentMonth, setCurrentMonth] = useState<string | null>(initialActiveMonth);

  const { execute, result, isPending } = useAction(fetchEnterpriseBilling);

  const billings: BillingWithInstallments[] =
    (result.data?.billings as BillingWithInstallments[] | undefined) ?? initialBillings;
  const metrics: DashboardMetricsType | null =
    (result.data?.metrics as DashboardMetricsType | null | undefined) ?? initialMetrics;
  const professionals: EnterpriseBillingProfessional[] =
    result.data?.professionals ?? initialProfessionals;

  const fetchData = useCallback(
    (profId: string | null, month: string | null) => {
      const dateRange = month ? getMonthRange(month) : undefined;
      execute({
        professionalId: profId ?? undefined,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
    },
    [execute],
  );

  const handleProfessionalClick = (id: string) => {
    const isSame = professionalFilter === id;
    const newFilter = isSame ? null : id;
    setProfessionalFilter(newFilter);
    fetchData(newFilter, currentMonth);
  };

  const handleMonthChange = (month: string | null) => {
    setCurrentMonth(month);
    fetchData(professionalFilter, month);
  };

  const activeMonthForHook = currentMonth ?? dayjs().format("YYYY-MM");

  const {
    activeFilter,
    handleFilterClick,
    filteredBillings,
    billingMetrics,
    activeMonthLabel,
    sectionTitle,
  } = useBillingDashboard({
    billings,
    metrics,
    activeMonth: activeMonthForHook,
  });

  const [showNewBillingModal, setShowNewBillingModal] = useState(false);
  const { execute: fetchBillingPatients, result: billingPatientsResult } = useAction(
    getEnterprisePatientsForBillingAction,
  );

  const handleOpenNewBilling = () => {
    if (!billingPatientsResult.data) fetchBillingPatients();
    setShowNewBillingModal(true);
  };

  const professionalsMap = Object.fromEntries(professionals.map((p) => [p.id, p.name ?? p.id]));

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
            <div />
            <div className="flex items-center gap-2">
              <Button size="sm" className="gradient-primary" onClick={handleOpenNewBilling}>
                <Plus className="mr-1 h-4 w-4" />
                Nova Cobrança
              </Button>
            </div>
          </div>

          {/* Metrics */}
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

          {/* Installments list */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-medium font-poppins text-lg">{sectionTitle}</h2>
              <BillingViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
            {isPending ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {[0, 1, 2, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredBillings.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhuma cobrança"
                description={
                  activeFilter
                    ? "Nenhuma cobrança encontrada para este filtro."
                    : "As cobranças dos profissionais aparecerão aqui."
                }
              />
            ) : viewMode === "expanded" ? (
              <div className="flex flex-col gap-3">
                {filteredBillings.map((billing) => (
                  <BillingGroupCardExpanded
                    key={billing.id}
                    billing={billing}
                    installments={billing.filteredInstallments}
                    professionals={professionalsMap}
                  />
                ))}
              </div>
            ) : viewMode === "table" ? (
              <BillingTable billings={filteredBillings} professionals={professionalsMap} />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredBillings.map((billing) => (
                  <BillingGroupCard
                    key={billing.id}
                    billing={billing}
                    installments={billing.filteredInstallments}
                    professionals={professionalsMap}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewBillingModal
        isStaff
        patients={billingPatientsResult.data?.patients ?? []}
        showModal={showNewBillingModal}
        setShowModal={setShowNewBillingModal}
        callback={() => fetchData(professionalFilter, currentMonth)}
      />
    </div>
  );
}
