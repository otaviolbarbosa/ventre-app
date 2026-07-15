"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Input } from "../../input";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { cn } from "../../utils/utils";

export interface SearchableDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

type SearchableDropdownValue<TMultiple extends boolean> = TMultiple extends true
  ? string[]
  : string;

export interface SearchableDropdownProps<TMultiple extends boolean = false> {
  options: SearchableDropdownOption[];
  value?: SearchableDropdownValue<TMultiple>;
  onChange: (value: SearchableDropdownValue<TMultiple>) => void;
  multiple?: TMultiple;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  className?: string;
  maxSelectedPerGroup?: number;
}

export function SearchableDropdown<TMultiple extends boolean = false>({
  options,
  value,
  onChange,
  multiple,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado",
  disabled = false,
  loading = false,
  loadingMessage = "Carregando...",
  className,
  maxSelectedPerGroup,
}: SearchableDropdownProps<TMultiple>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Dialog/Sheet lock body scroll via react-remove-scroll, which only allows
  // wheel/touch events whose target lives inside the modal's own content node.
  // This popover renders in a separate portal, so its scroll gets blocked
  // unless we stop the event from reaching that document-level listener.
  // A callback ref is required (not useEffect+useRef): Radix mounts the
  // popover content via Presence in a later commit than the one that flips
  // `open`, so a useEffect keyed on `open` can run before the node exists.
  const listRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener("wheel", stop, { capture: true });
    node.addEventListener("touchmove", stop, { capture: true });
    return () => {
      node.removeEventListener("wheel", stop, { capture: true });
      node.removeEventListener("touchmove", stop, { capture: true });
    };
  }, []);

  const selectedValues = multiple
    ? ((value as string[] | undefined) ?? [])
    : value
      ? [value as string]
      : [];

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedOptions = filteredOptions.reduce<
    { group?: string; options: SearchableDropdownOption[] }[]
  >((groups, option) => {
    const lastGroup = groups.find((g) => g.group === option.group);
    if (lastGroup) {
      lastGroup.options.push(option);
    } else {
      groups.push({ group: option.group, options: [option] });
    }
    return groups;
  }, []);

  function isSelected(optionValue: string) {
    return selectedValues.includes(optionValue);
  }

  function isGroupLimitReached(group?: string) {
    if (!multiple || !maxSelectedPerGroup) return false;
    const selectedInGroup = options.filter(
      (option) => option.group === group && isSelected(option.value),
    ).length;
    return selectedInGroup >= maxSelectedPerGroup;
  }

  function handleSelect(optionValue: string) {
    if (multiple) {
      const next = isSelected(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next as SearchableDropdownValue<TMultiple>);
      return;
    }

    onChange(optionValue as SearchableDropdownValue<TMultiple>);
    setOpen(false);
    setSearch("");
  }

  const label =
    selectedValues.length === 0
      ? placeholder
      : multiple
        ? selectedValues.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
        : (options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 border border-input bg-white px-3 py-2 text-sm shadow-sm ring-offset-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
            multiple ? "rounded-2xl text-left" : "whitespace-nowrap rounded-full",
            className,
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
          <span
            className={cn(
              "min-w-0 flex-1 text-left",
              multiple ? "whitespace-normal break-words" : "truncate",
              selectedValues.length === 0 ? "text-muted-foreground" : "",
            )}
          >
            {loading ? loadingMessage : label}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="border-b p-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-full"
          />
        </div>
        <div ref={listRefCallback} className="max-h-60 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">{emptyMessage}</p>
          ) : (
            groupedOptions.map((group, groupIndex) => (
              <div key={group.group ?? `__ungrouped_${groupIndex}`}>
                {group.group ? (
                  <p className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {group.group}
                  </p>
                ) : null}
                {group.options.map((option) => {
                  const selected = isSelected(option.value);
                  const groupDisabled = !selected && isGroupLimitReached(option.group);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled || groupDisabled}
                      className="flex w-full cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                      onClick={() => handleSelect(option.value)}
                    >
                      {option.label}
                      {multiple && selected ? <Check className="h-4 w-4 opacity-70" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
