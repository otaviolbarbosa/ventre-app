"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ListFilter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FilterOption = {
  value: string;
  label: string;
};

type FilterDropdownProps = {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterDropdown({ options, value, onChange }: FilterDropdownProps) {
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  return (
    <div ref={filterRef} className="relative">
      <Button
        size="icon"
        variant={value !== options[0]?.value ? "secondary" : "outline"}
        onClick={() => setShowFilters((prev) => !prev)}
      >
        <ListFilter className="size-4" />
      </Button>
      <div
        className={cn(
          "absolute top-full right-0 z-10 mt-2 flex flex-col gap-1.5 rounded-xl border bg-background p-2 shadow-md transition-opacity duration-200",
          showFilters ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setShowFilters(false);
            }}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
              value === option.value && "font-medium text-primary",
            )}
          >
            <Check
              className={cn(
                "size-4 shrink-0",
                value === option.value ? "opacity-100" : "opacity-0",
              )}
            />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
