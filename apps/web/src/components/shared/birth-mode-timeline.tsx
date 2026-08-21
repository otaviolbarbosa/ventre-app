"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_CONTRACTION_EFFECTIVENESS_LABELS,
  BIRTH_EVENT_CONFIG,
  BIRTH_MEDICATION_TYPE_LABELS,
} from "@/lib/birth-mode-constants";
import { dayjs } from "@/lib/dayjs";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";

function describeEvent(event: BirthModeTimelineEvent): string {
  switch (event.type) {
    case "active_labor_entry":
      return "Entrada em fase ativa registrada";
    case "contraction": {
      const { duration_seconds, effectiveness } = event.payload as {
        duration_seconds: number;
        effectiveness: string | null;
      };
      const label = effectiveness ? BIRTH_CONTRACTION_EFFECTIVENESS_LABELS[effectiveness] : null;
      return `Contração de ${duration_seconds}s${label ? ` (${label})` : ""}`;
    }
    case "cervical_dilation": {
      const { dilation_cm } = event.payload as { dilation_cm: number };
      return `Dilatação: ${dilation_cm} cm`;
    }
    case "fetal_station": {
      const { station_lee } = event.payload as { station_lee: number };
      return `Altura de apresentação: ${station_lee > 0 ? "+" : ""}${station_lee}`;
    }
    case "fetal_heart_rate": {
      const { bpm } = event.payload as { bpm: number };
      return `FCF: ${bpm} bpm`;
    }
    case "amniotic_fluid": {
      const { fluid_type } = event.payload as { fluid_type: string };
      return `Fluido amniótico: ${AMNIOTIC_FLUID_TYPE_LABELS[fluid_type] ?? fluid_type}`;
    }
    case "medication": {
      const { medication_type, other_birth_medication_type } = event.payload as {
        medication_type: string;
        other_birth_medication_type: string | null;
      };
      const label =
        medication_type === "outros" && other_birth_medication_type
          ? other_birth_medication_type
          : (BIRTH_MEDICATION_TYPE_LABELS[medication_type] ?? medication_type);
      return `Medicamento: ${label}`;
    }
    case "membrane_rupture":
      return "Bolsa rota";
    default:
      return "";
  }
}

type BirthModeTimelineProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeTimeline({ events }: BirthModeTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nenhum registro ainda"
        description="Os registros do parto aparecerão aqui assim que forem feitos por qualquer profissional da equipe."
      />
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <div className="divide-y divide-border rounded-lg border">
      {sorted.map((event) => {
        const config = BIRTH_EVENT_CONFIG[event.type];
        const Icon = config.icon;
        return (
          <div key={event.id} className="flex items-start gap-3 p-4">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.colorClass}`} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{describeEvent(event)}</p>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {dayjs(event.occurredAt).format("HH:mm")}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">Por: {event.professionalName}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
