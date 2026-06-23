"use client";

import {
  type AppliedBillingFee,
  computeNetAmountCents,
  computeTotalNetAmountCents,
  formatCurrency,
} from "@/lib/billing/calculations";
import { Badge } from "@ventre/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@ventre/ui/popover";
import { Info } from "lucide-react";
import { useState } from "react";

type ProfessionalNetAmountProps = {
  professionalId?: string;
  professionalName?: string;
  grossAmountCents: number;
  appliedFees: AppliedBillingFee[];
};

export function ProfessionalNetAmount({
  professionalId,
  professionalName,
  grossAmountCents,
  appliedFees,
}: ProfessionalNetAmountProps) {
  const [open, setOpen] = useState(false);
  const { netAmountCents, totalFeesCents, feeLineItems } = professionalId
    ? computeNetAmountCents(grossAmountCents, appliedFees, professionalId)
    : computeTotalNetAmountCents(grossAmountCents, appliedFees);

  const label = professionalName ?? "Valor líquido";
  console.log(professionalName);

  if (feeLineItems.length === 0) {
    return (
      <div className="flex justify-between text-muted-foreground text-xs">
        <span>{label}</span>
        <span>{formatCurrency(grossAmountCents)}</span>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <Badge variant="outline" className="gap-1 font-normal">
            −{formatCurrency(totalFeesCents)}
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Detalhes das taxas aplicadas"
                className="-mr-1 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted-foreground/10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen((value) => !value);
                }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
              >
                <Info className="size-3" />
              </button>
            </PopoverTrigger>
          </Badge>
          <PopoverContent
            className="w-64 space-y-1 p-3"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Valor bruto</span>
              <span>{formatCurrency(grossAmountCents)}</span>
            </div>
            {feeLineItems.map((fee) => (
              <div key={fee.fee_id} className="flex justify-between text-muted-foreground text-xs">
                <span>
                  {fee.name} (
                  {fee.fee_type === "fixed" ? formatCurrency(fee.value) : `${fee.value}%`})
                </span>
                <span>−{formatCurrency(fee.amountCents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1 font-medium text-xs">
              <span>Valor líquido</span>
              <span>{formatCurrency(netAmountCents)}</span>
            </div>
          </PopoverContent>
        </Popover>
        <span className="font-medium">{formatCurrency(netAmountCents)}</span>
      </span>
    </div>
  );
}
