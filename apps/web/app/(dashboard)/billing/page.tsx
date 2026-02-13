"use client";

import { BillingCard } from "@/components/billing/billing-card";
import { DashboardMetrics, type FilterKey } from "@/components/billing/dashboard-metrics";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";
import type { Tables } from "@nascere/supabase/types";
import { Receipt } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string; due_date: string }[];
  patient: { id: string; name: string };
};

type Metrics = {
  total_amount: number;
  paid_amount: number;
  overdue_amount: number;
  upcoming_due: unknown[];
};

const FILTER_LABELS: Record<FilterKey, string> = {
  total: "Total a Receber",
  paid: "Recebido",
  overdue: "Em Atraso",
  upcoming: "Próximos Vencimentos",
};

export default function BillingDashboardPage() {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const sectionRef = useRef<HTMLHeadingElement>(null);

  const handleFilterClick = useCallback((filter: FilterKey) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const [billingsRes, metricsRes] = await Promise.all([
        fetch(`/api/billing?${params.toString()}`),
        fetch(`/api/billing/dashboard?${params.toString()}`),
      ]);

      const billingsData = await billingsRes.json();
      const metricsData = await metricsRes.json();

      setBillings(billingsData.billings || []);
      setMetrics(metricsData.metrics || null);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBillings = useMemo(() => {
    if (!activeFilter) return billings;

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    return billings.filter((billing) => {
      switch (activeFilter) {
        case "total":
          return billing.paid_amount < billing.total_amount && billing.status !== "cancelado";
        case "paid":
          return billing.paid_amount > 0;
        case "overdue":
          return billing.installments.some((i) => i.status === "atrasado");
        case "upcoming":
          return billing.installments.some((i) => {
            if (i.status !== "pendente") return false;
            const dueDate = new Date(i.due_date);
            return dueDate >= now && dueDate <= in7Days;
          });
        default:
          return true;
      }
    });
  }, [billings, activeFilter]);

  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : "Cobranças Recentes";

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="start_date" className="text-muted-foreground text-sm">
              De:
            </label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 sm:w-auto sm:flex-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="end_date" className="text-muted-foreground text-sm">
              Até:
            </label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 sm:w-auto sm:flex-none"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {metrics && (
              <DashboardMetrics
                totalAmount={metrics.total_amount}
                paidAmount={metrics.paid_amount}
                overdueAmount={metrics.overdue_amount}
                upcomingCount={metrics.upcoming_due.length}
                activeFilter={activeFilter}
                onFilterClick={handleFilterClick}
              />
            )}

            <div>
              <h2 className="mb-3 font-semibold text-lg">{sectionTitle}</h2>
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
              ) : (
                <div className="space-y-3">
                  {filteredBillings.map((billing) => (
                    <BillingCard key={billing.id} billing={billing} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
