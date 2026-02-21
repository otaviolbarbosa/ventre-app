"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculations";
import type { LucideIcon } from "lucide-react";

export type FilterKey = "total" | "paid" | "overdue" | "upcoming";

export type MetricItem = {
  key: FilterKey;
  title: string;
  amount: number;
  icon: LucideIcon;
};

const METRIC_STYLES: Record<FilterKey, { color: string; bg: string; ring: string }> = {
  total: { color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-400" },
  paid: { color: "text-green-600", bg: "bg-green-50", ring: "ring-green-400" },
  overdue: { color: "text-red-600", bg: "bg-red-50", ring: "ring-red-400" },
  upcoming: { color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-400" },
};

type MetricsProps = {
  metrics: MetricItem[];
  activeFilter: FilterKey | null;
  onFilterClick: (filter: FilterKey) => void;
};

export function DashboardMetrics({ metrics, activeFilter, onFilterClick }: MetricsProps) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {metrics.map((metric) => {
        const isActive = activeFilter === metric.key;
        const styles = METRIC_STYLES[metric.key];
        return (
          <Card
            key={metric.key}
            className={`w-44 shrink-0 cursor-pointer transition-shadow sm:w-auto ${isActive ? `ring-2 ${styles.ring}` : ""}`}
            onClick={() => onFilterClick(metric.key)}
          >
            <CardContent className="space-y-2 p-4">
              <p className="whitespace-nowrap font-semibold text-muted-foreground text-sm">
                {metric.title}
              </p>
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${styles.bg}`}>
                  <metric.icon className={`h-5 w-5 ${styles.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-lg">{formatCurrency(metric.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
