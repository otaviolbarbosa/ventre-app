"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculations";
import { AlertTriangle, Clock, DollarSign, TrendingUp } from "lucide-react";

export type FilterKey = "total" | "paid" | "overdue" | "upcoming";

type MetricsProps = {
  totalAmount: number;
  paidAmount: number;
  overdueAmount: number;
  upcomingCount: number;
  activeFilter: FilterKey | null;
  onFilterClick: (filter: FilterKey) => void;
};

export function DashboardMetrics({
  totalAmount,
  paidAmount,
  overdueAmount,
  upcomingCount,
  activeFilter,
  onFilterClick,
}: MetricsProps) {
  const metrics = [
    {
      key: "total" as FilterKey,
      label: "Total a Receber",
      value: formatCurrency(totalAmount),
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
      ring: "ring-blue-400",
    },
    {
      key: "paid" as FilterKey,
      label: "Recebido",
      value: formatCurrency(paidAmount),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      ring: "ring-green-400",
    },
    {
      key: "overdue" as FilterKey,
      label: "Em Atraso",
      value: formatCurrency(overdueAmount),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      ring: "ring-red-400",
    },
    {
      key: "upcoming" as FilterKey,
      label: "Próximos Vencimentos",
      value: String(upcomingCount),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      ring: "ring-amber-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const isActive = activeFilter === metric.key;
        return (
          <Card
            key={metric.key}
            className={`cursor-pointer transition-shadow ${isActive ? `ring-2 ${metric.ring}` : ""}`}
            onClick={() => onFilterClick(metric.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${metric.bg}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{metric.label}</p>
                  <p className="font-semibold text-lg">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
