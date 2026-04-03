"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@ventre/ui/popover";
import { ChevronDown, Stethoscope, Users, X } from "lucide-react";
import { useState } from "react";

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type BaseProfessional = {
  id: string;
  name: string | null;
  professional_type: string | null;
  avatar_url?: string;
};

type ProfessionalsSelectorProps<T extends BaseProfessional> = {
  professionals: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getCountLabel?: (prof: T) => string;
};

export function ProfessionalsSelector<T extends BaseProfessional>({
  professionals,
  selectedId,
  onSelect,
  getCountLabel,
}: ProfessionalsSelectorProps<T>) {
  const [open, setOpen] = useState(false);

  if (professionals.length === 0) return null;

  const selected = professionals.find((p) => p.id === selectedId) ?? null;

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    if (selectedId) onSelect(selectedId);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex w-full items-center sm:w-auto">
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-12 flex-1 items-center gap-2 rounded-full border bg-background px-4 text-sm transition-colors hover:bg-muted/40 sm:flex-none",
              selected ? "rounded-r-none border-primary border-r-0 bg-primary/5 pr-3 pl-2" : "pr-3",
            )}
          >
            {selected ? (
              <>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={selected.avatar_url}
                    alt={selected.name || ""}
                    className="rounded-full object-cover"
                  />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {getInitials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-primary">{selected.name ?? "—"}</span>
              </>
            ) : (
              <>
                <div className="-ml-2 flex size-8 items-center justify-center rounded-full bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-left text-muted-foreground">
                  Todas as profissionais
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </>
            )}
          </button>
        </PopoverTrigger>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="flex h-12 items-center rounded-r-full border border-primary border-l-0 bg-primary/5 px-3 hover:bg-primary/10"
          >
            <X className="h-4 w-4 text-primary" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2 sm:w-72">
        <div className="flex flex-col gap-1">
          {professionals.map((prof) => {
            const isSelected = selectedId === prof.id;
            const countLabel = getCountLabel?.(prof);
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => handleSelect(prof.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60",
                  isSelected && "bg-primary/5",
                )}
              >
                <Avatar className="h-9 w-9 shrink-0 shadow-md">
                  <AvatarImage
                    src={prof.avatar_url}
                    alt={prof.name || ""}
                    className="rounded-full object-cover"
                  />

                  <AvatarFallback
                    className={cn(
                      "text-sm",
                      isSelected ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary",
                    )}
                  >
                    {getInitials(prof.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium text-sm", isSelected && "text-primary")}>
                    {prof.name ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {prof.professional_type
                      ? (PROFESSIONAL_TYPE_LABELS[prof.professional_type] ?? prof.professional_type)
                      : "Profissional"}
                  </p>
                  {countLabel && (
                    <div className="mt-0.5 flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">{countLabel}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
