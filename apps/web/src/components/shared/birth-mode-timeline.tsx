"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_CONTRACTION_EFFECTIVENESS_LABELS,
  BIRTH_EVENT_CONFIG,
  BIRTH_MEDICATION_TYPE_LABELS,
  BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS,
  BIRTH_URINE_DIPSTICK_LABELS,
} from "@/lib/birth-mode-constants";
import { dayjs } from "@/lib/dayjs";
import { Activity } from "lucide-react";

function describeEvent(event: BirthModeTimelineEvent): string {
  switch (event.type) {
    case "start_monitoring":
      return "Início do acompanhamento registrado";
    case "contraction": {
      const { duration_seconds, effectiveness, contractions_per_10min } = event.payload as {
        duration_seconds: number;
        effectiveness: string | null;
        contractions_per_10min: number | null;
      };
      const label = effectiveness ? BIRTH_CONTRACTION_EFFECTIVENESS_LABELS[effectiveness] : null;
      const frequency =
        contractions_per_10min != null ? ` - ${contractions_per_10min}x/10min` : "";
      return `Contração de ${duration_seconds}s${frequency}${label ? ` (${label})` : ""}`;
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
      return `BCF: ${bpm} bpm`;
    }
    case "amniotic_fluid": {
      const { fluid_type } = event.payload as { fluid_type: string };
      return `Fluido amniótico: ${AMNIOTIC_FLUID_TYPE_LABELS[fluid_type] ?? fluid_type}`;
    }
    case "medication": {
      const {
        medication_type,
        other_birth_medication_type,
        oxytocin_concentration_u_per_l,
        oxytocin_drip_rate_gtt_per_min,
      } = event.payload as {
        medication_type: string;
        other_birth_medication_type: string | null;
        oxytocin_concentration_u_per_l: number | null;
        oxytocin_drip_rate_gtt_per_min: number | null;
      };
      const label =
        medication_type === "outros" && other_birth_medication_type
          ? other_birth_medication_type
          : (BIRTH_MEDICATION_TYPE_LABELS[medication_type] ?? medication_type);
      const oxytocinDetail =
        medication_type === "ocitocina" &&
        oxytocin_concentration_u_per_l != null &&
        oxytocin_drip_rate_gtt_per_min != null
          ? ` - ${oxytocin_concentration_u_per_l} U/L - ${oxytocin_drip_rate_gtt_per_min} gtt/min`
          : "";
      return `Medicamento: ${label}${oxytocinDetail}`;
    }
    case "membrane_rupture": {
      const { rupture_type, fluid_type_at_rupture } = event.payload as {
        rupture_type: string | null;
        fluid_type_at_rupture: string | null;
      };
      const typeLabel = rupture_type ? BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS[rupture_type] : null;
      const fluidLabel = fluid_type_at_rupture
        ? AMNIOTIC_FLUID_TYPE_LABELS[fluid_type_at_rupture]
        : null;
      const detail = [typeLabel, fluidLabel ? `líquido ${fluidLabel.toLowerCase()}` : null]
        .filter(Boolean)
        .join(" - ");
      return `Bolsa rota${detail ? `: ${detail}` : ""}`;
    }
    case "maternal_vitals": {
      const { systolic_bp, diastolic_bp, pulse_bpm, temperature_celsius } = event.payload as {
        systolic_bp: number | null;
        diastolic_bp: number | null;
        pulse_bpm: number | null;
        temperature_celsius: number | null;
      };
      const parts = [
        systolic_bp != null && diastolic_bp != null ? `PA ${systolic_bp}/${diastolic_bp}` : null,
        pulse_bpm != null ? `Pulso ${pulse_bpm}` : null,
        temperature_celsius != null ? `${temperature_celsius}°C` : null,
      ].filter(Boolean);
      return parts.length > 0 ? `Vitais: ${parts.join(" - ")}` : "Vitais maternos registrados";
    }
    case "urine_test": {
      const { protein_level, ketone_level, volume_ml } = event.payload as {
        protein_level: string | null;
        ketone_level: string | null;
        volume_ml: number | null;
      };
      const parts = [
        protein_level ? `Proteína ${BIRTH_URINE_DIPSTICK_LABELS[protein_level]}` : null,
        ketone_level ? `Cetonúria ${BIRTH_URINE_DIPSTICK_LABELS[ketone_level]}` : null,
        volume_ml != null ? `${volume_ml}ml` : null,
      ].filter(Boolean);
      return parts.length > 0 ? `Urina: ${parts.join(" - ")}` : "Urina registrada";
    }
    case "apgar": {
      const { minute, total } = event.payload as { minute: number; total: number };
      return `Apgar min ${minute}: ${total}`;
    }
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
