"use client";

import { cn } from "@/lib/utils";
import { MONTH_LABELS_SHORT } from "@/services/home";

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
    <div className="-mx-4 no-scrollbar flex h-14 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const isSelected = selectedMonth === item.month && selectedYear === item.year;
        return (
          <button
            key={`${item.year}-${item.month}`}
            type="button"
            onClick={() => onSelect(item.month, item.year)}
            className={cn(
              "border≥ flex shrink-0 items-center gap-4 rounded-full py-2 pr-2 pl-5 shadow-sm transition-all",
              isSelected
                ? "gradient-primary bg-primary text-white"
                : "bg-white text-gray-800 hover:border-gray-300",
            )}
          >
            <span
              className={cn("font-poppins font-semibold text-lg", !isSelected && "text-primary")}
            >
              {MONTH_LABELS_SHORT[item.month]}
            </span>
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full font-bold",
                isSelected ? "bg-white text-gray-800" : "bg-background text-gray-700",
                item.count > 100 ? "text-sm" : "text-lg",
              )}
            >
              {item.count > 100 ? "99+" : item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
