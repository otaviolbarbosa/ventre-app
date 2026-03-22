"use client";

import type { FilterKey } from "@/components/billing/dashboard-metrics";
import {
  FILTER_LABELS,
  PERIOD_OPTIONS,
  buildBillingMetrics,
  filterInstallments,
  flattenInstallments,
} from "@/lib/billing/dashboard";
import type { BillingPeriod } from "@/lib/billing/period-range";
import type { BillingWithInstallments, DashboardMetrics } from "@/services/billing";
import { useCallback, useMemo, useState } from "react";

type UseBillingDashboardOptions = {
  billings: BillingWithInstallments[];
  metrics: DashboardMetrics | null;
  activePeriod: BillingPeriod | null;
};

export function useBillingDashboard({ billings, metrics, activePeriod }: UseBillingDashboardOptions) {
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  const handleFilterClick = useCallback((filter: FilterKey) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }, []);

  const filteredInstallments = useMemo(
    () => filterInstallments(flattenInstallments(billings), activeFilter),
    [billings, activeFilter],
  );

  const billingMetrics = useMemo(
    () => (metrics ? buildBillingMetrics(metrics) : []),
    [metrics],
  );

  const activePeriodLabel = PERIOD_OPTIONS.find((o) => o.key === activePeriod)?.label;
  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : "Cobranças Recentes";

  return {
    activeFilter,
    handleFilterClick,
    filteredInstallments,
    billingMetrics,
    activePeriodLabel,
    sectionTitle,
  };
}
