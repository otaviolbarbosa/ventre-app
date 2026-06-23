"use client";

import type { BillingViewMode } from "@/hooks/use-billing-view-mode";
import { cn } from "@/lib/utils";
import { Button } from "@ventre/ui/button";
import { LayoutGrid, StretchHorizontal } from "lucide-react";

type BillingViewSwitcherProps = {
  value: BillingViewMode;
  onChange: (view: BillingViewMode) => void;
};

export function BillingViewSwitcher({ value, onChange }: BillingViewSwitcherProps) {
  return (
    <div className="inline-flex gap-1 rounded-full border p-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "bg-transparent hover:bg-transparent",
          value === "simplified" &&
            "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
        )}
        onClick={(e) => {
          e.preventDefault();
          onChange("simplified");
        }}
      >
        <LayoutGrid />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "bg-transparent hover:bg-transparent",
          value === "expanded" &&
            "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
        )}
        onClick={(e) => {
          e.preventDefault();
          onChange("expanded");
        }}
      >
        <StretchHorizontal />
      </Button>
    </div>
  );
}
