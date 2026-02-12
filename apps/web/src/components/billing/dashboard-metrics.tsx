"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculations";
import { AlertTriangle, Clock, DollarSign, TrendingUp } from "lucide-react";

type MetricsProps = {
  totalAmount: number;
  paidAmount: number;
  overdueAmount: number;
  upcomingCount: number;
};

export function DashboardMetrics({
  totalAmount,
  paidAmount,
  overdueAmount,
  upcomingCount,
}: MetricsProps) {
  const metrics = [
    {
      label: "Total a Receber",
      value: formatCurrency(totalAmount),
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Recebido",
      value: formatCurrency(paidAmount),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Em Atraso",
      value: formatCurrency(overdueAmount),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Próximos Vencimentos",
      value: String(upcomingCount),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
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
      ))}
    </div>
  );
}
