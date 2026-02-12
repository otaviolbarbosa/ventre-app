"use client";

import { BillingCard } from "@/components/billing/billing-card";
import { DashboardMetrics } from "@/components/billing/dashboard-metrics";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Header } from "@/components/layouts/header";
import { Input } from "@/components/ui/input";
import type { Tables } from "@nascere/supabase/types";
import { Receipt } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string }[];
  patient: { id: string; name: string };
};

type Metrics = {
  total_amount: number;
  paid_amount: number;
  overdue_amount: number;
  upcoming_due: unknown[];
};

export default function BillingDashboardPage() {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="start_date" className="text-muted-foreground text-sm">
              De:
            </label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
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
              className="w-auto"
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
              />
            )}

            <div>
              <h2 className="mb-3 font-semibold text-lg">Cobranças Recentes</h2>
              {billings.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Nenhuma cobrança"
                  description="Suas cobranças aparecerão aqui."
                />
              ) : (
                <div className="space-y-3">
                  {billings.map((billing) => (
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
