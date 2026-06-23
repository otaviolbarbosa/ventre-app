"use client";

import type { FilterKey } from "@/components/billing/dashboard-metrics";
import {
  FILTER_LABELS,
  buildBillingMetrics,
  groupBillingsByFilter,
} from "@/lib/billing/dashboard";
import { dayjs } from "@/lib/dayjs";
import type { BillingWithInstallments, DashboardMetrics } from "@/services/billing";
import { useCallback, useMemo, useState } from "react";

type UseBillingDashboardOptions = {
  billings: BillingWithInstallments[];
  metrics: DashboardMetrics | null;
  activeMonth: string;
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export function useBillingDashboard({
  billings,
  metrics,
  activeMonth,
}: UseBillingDashboardOptions) {
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  const handleFilterClick = useCallback((filter: FilterKey) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }, []);

  const filteredBillings = useMemo(
    () => groupBillingsByFilter(billings, activeFilter),
    [billings, activeFilter],
  );

  const billingMetrics = useMemo(() => (metrics ? buildBillingMetrics(metrics) : []), [metrics]);

  const activeMonthLabel = `${capitalize(dayjs(activeMonth).format("MMMM"))} de ${dayjs(activeMonth).format("YYYY")}`;
  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : "Cobranças Recentes";

  return {
    activeFilter,
    handleFilterClick,
    filteredBillings,
    billingMetrics,
    activeMonthLabel,
    sectionTitle,
  };
}
