"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BIRTH_MEDICATION_TYPE_LABELS } from "@/lib/birth-mode-constants";
import { dayjs } from "@/lib/dayjs";

type BirthModeMedicationListProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeMedicationList({ events }: BirthModeMedicationListProps) {
  const medicationEvents = events
    .filter(
      (event) =>
        event.type === "medication" &&
        (event.payload as { medication_type: string }).medication_type !== "ocitocina",
    )
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  if (medicationEvents.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-xs">
        Nenhuma medicação (além de ocitocina) registrada ainda
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {medicationEvents.map((event) => {
        const { medication_type, other_birth_medication_type } = event.payload as {
          medication_type: string;
          other_birth_medication_type: string | null;
        };
        const label =
          medication_type === "outros" && other_birth_medication_type
            ? other_birth_medication_type
            : (BIRTH_MEDICATION_TYPE_LABELS[medication_type] ?? medication_type);

        return (
          <div key={event.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>{label}</span>
            <span className="whitespace-nowrap text-muted-foreground text-xs">
              {dayjs(event.occurredAt).format("HH:mm")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
