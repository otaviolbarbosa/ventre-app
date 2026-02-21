"use client";

import { Input } from "@/components/ui/input";
import { type ChangeEvent, useCallback, useState } from "react";

type CurrencyInputProps = {
  value: number;
  onChange: (valueInCents: number) => void;
  disabled?: boolean;
  placeholder?: string;
};

function formatDisplay(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseToCents(displayValue: string): number {
  const cleaned = displayValue.replace(/\./g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function CurrencyInput({
  value,
  onChange,
  disabled,
  placeholder = "0,00",
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => formatDisplay(value));

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow only digits, comma, and dot
      const filtered = raw.replace(/[^\d.,]/g, "");
      setDisplay(filtered);
      const cents = parseToCents(filtered);
      onChange(cents);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setDisplay(formatDisplay(value));
  }, [value]);

  return (
    <div className="relative">
      <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-muted-foreground text-sm">
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}
