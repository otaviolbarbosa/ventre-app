"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MONTH_LABELS_FULL } from "@/services/home";
import { TrendingDown, TrendingUp } from "lucide-react";

type DppMonthItem = {
  month: number;
  year: number;
  count: number;
  percentage: number;
};

type DppMonthCarouselProps = {
  items: DppMonthItem[];
  selectedMonth: number | null;
  selectedYear: number | null;
  onSelect: (month: number, year: number) => void;
};

export function DppMonthCarousel({
  items,
  selectedMonth,
  selectedYear,
  onSelect,
}: DppMonthCarouselProps) {
  if (items.length === 0) return null;

  return (
    <div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const isSelected = selectedMonth === item.month && selectedYear === item.year;
        return (
          <button
            key={`${item.year}-${item.month}`}
            type="button"
            onClick={() => onSelect(item.month, item.year)}
          >
            <Card
              className={cn(
                "shrink-0 transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <CardContent className="px-4 py-3">
                <div className="space-y-1">
                  <div className="flex min-w-[120px] items-center justify-between gap-3">
                    <p
                      className={cn(
                        "font-bold font-poppins text-lg",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {MONTH_LABELS_FULL[item.month]}
                    </p>
                    {item.percentage !== 0 && (
                      <div
                        className={cn(
                          "flex items-start gap-0.5 rounded-full font-medium text-[10px]",
                          item.percentage >= 0 ? "text-green-600" : "text-destructive",
                        )}
                      >
                        {Math.abs(item.percentage)}%
                        {item.percentage >= 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-4">
                    <p className="font-bold font-poppins text-xl">{item.count}</p>
                    <span className="text-muted-foreground text-xs">Gestantes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
