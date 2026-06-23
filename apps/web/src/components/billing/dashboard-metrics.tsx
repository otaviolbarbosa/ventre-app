"use client";
import { dayjs } from "@/lib/dayjs";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TotalAmount } from "./total-amount";

export type FilterKey = "total" | "paid" | "overdue" | "upcoming";

export type MetricItem = {
  key: FilterKey;
  title: string;
  amount: number;
  icon: LucideIcon;
};

const METRIC_STYLES: Record<
  FilterKey,
  { color: string; bg: string; ring: string; border: string; label: string }
> = {
  total: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-400",
    border: "border-blue-100",
    label: "text-blue-700",
  },
  paid: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-400",
    border: "border-emerald-100",
    label: "text-emerald-700",
  },
  overdue: {
    color: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-400",
    border: "border-red-100",
    label: "text-red-700",
  },
  upcoming: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-400",
    border: "border-amber-100",
    label: "text-amber-700",
  },
};

type MetricsProps = {
  metrics: MetricItem[];
  activeFilter: FilterKey | null;
  onFilterClick: (filter: FilterKey) => void;
  activeMonth: string;
  activeMonthLabel: string;
  onMonthChange: (month: string | null) => void;
};

export function DashboardMetrics({
  metrics,
  activeFilter,
  onFilterClick,
  activeMonth,
  activeMonthLabel,
  onMonthChange,
}: MetricsProps) {
  const handlePrev = () => {
    const prev = dayjs(activeMonth).subtract(1, "month").format("YYYY-MM");
    onMonthChange(prev);
  };

  const handleNext = () => {
    const next = dayjs(activeMonth).add(1, "month").format("YYYY-MM");
    onMonthChange(next);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Month navigator */}
        <div className="flex px-3 py-2">
          <div className="flex w-full items-center justify-between gap-1 sm:justify-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handlePrev}
              // disabled={isAllTime}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* <span className="min-w-[148px] text-center font-semibold text-sm">
              {isAllTime ? "Todos os meses" : activeMonthLabel}
            </span> */}
            <span className="min-w-[148px] text-center font-semibold text-sm">
              {activeMonthLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleNext}
              // disabled={isAllTime}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {metrics.map((metric) => {
            const isActive = activeFilter === metric.key;
            const styles = METRIC_STYLES[metric.key];
            return (
              <Card
                key={metric.key}
                className={`w-44 shrink-0 cursor-pointer border transition-all duration-150 hover:shadow-md sm:w-auto sm:shrink ${styles.border} ${isActive ? `ring-2 ${styles.ring} shadow-sm` : "hover:border-transparent"}`}
                onClick={() => onFilterClick(metric.key)}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`rounded-lg p-1.5 ${styles.bg}`}>
                      <metric.icon className={`h-4 w-4 ${styles.color}`} />
                    </div>
                    <p className={`whitespace-nowrap font-medium text-xs ${styles.label}`}>
                      {metric.title}
                    </p>
                  </div>
                  <TotalAmount amount={metric.amount} />
                  {/* <p className="font-bold text-foreground text-lg leading-none">
                    {formatCurrency(metric.amount)}
                  </p> */}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
