"use client";

import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS } from "@/lib/billing/dashboard";
import type { BillingPeriod } from "@/lib/billing/period-range";
import { cn } from "@/lib/utils";
import { Check, ListFilter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PeriodFilterDropdownProps = {
  activePeriod: BillingPeriod | null;
  onSelect: (period: BillingPeriod) => void;
};

export function PeriodFilterDropdown({ activePeriod, onSelect }: PeriodFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="icon"
        variant={activePeriod ? "secondary" : "outline"}
        onClick={() => setOpen((prev) => !prev)}
        className="gap-2"
      >
        <ListFilter className="h-4 w-4" />
      </Button>

      <div
        className={cn(
          "absolute top-full right-0 z-10 mt-2 flex min-w-48 flex-col gap-1 rounded-xl border bg-background p-2 shadow-md transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onSelect(option.key);
              setOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
              activePeriod === option.key && "font-medium text-primary",
            )}
          >
            <Check
              className={cn(
                "h-4 w-4 shrink-0",
                activePeriod === option.key ? "opacity-100" : "opacity-0",
              )}
            />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
