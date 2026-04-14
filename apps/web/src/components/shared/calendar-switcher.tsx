"use client";

import { cn } from "@/lib/utils";
import { Button } from "@ventre/ui/button";
import { Calendar, ListIcon } from "lucide-react";

type AgendaView = "list" | "calendar";

type CalendarSwitcherProps = {
  value: AgendaView;
  onChange: (view: AgendaView) => void;
};

export function CalendarSwitcher({ value, onChange }: CalendarSwitcherProps) {
  return (
    <div className="inline-flex gap-1 rounded-full border p-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "bg-transparent hover:bg-transparent",
          value === "list" &&
            "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
        )}
        onClick={(e) => {
          e.preventDefault();
          onChange("list");
        }}
      >
        <ListIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "bg-transparent hover:bg-transparent",
          value === "calendar" &&
            "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
        )}
        onClick={(e) => {
          e.preventDefault();
          onChange("calendar");
        }}
      >
        <Calendar />
      </Button>
    </div>
  );
}
