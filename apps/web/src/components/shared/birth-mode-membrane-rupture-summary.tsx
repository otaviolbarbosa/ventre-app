"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS,
} from "@/lib/birth-mode-constants";
import { dayjs } from "@/lib/dayjs";

type BirthModeMembraneRuptureSummaryProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeMembraneRuptureSummary({ events }: BirthModeMembraneRuptureSummaryProps) {
  // membrane_rupture é cardinality "single" (birth-mode-constants.ts) — no
  // máximo um registro esperado, tratado como resumo único, não lista.
  const ruptureEvent = events.find((event) => event.type === "membrane_rupture");
  const fluidEvents = events
    .filter((event) => event.type === "amniotic_fluid")
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  if (!ruptureEvent && fluidEvents.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-xs">
        Bolsa íntegra — nenhuma ruptura registrada ainda
      </p>
    );
  }

  const rupturePayload = ruptureEvent?.payload as
    | { rupture_type: string | null; fluid_type_at_rupture: string | null }
    | undefined;
  const ruptureTypeLabel = rupturePayload?.rupture_type
    ? BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS[rupturePayload.rupture_type]
    : null;
  const ruptureFluidLabel = rupturePayload?.fluid_type_at_rupture
    ? AMNIOTIC_FLUID_TYPE_LABELS[rupturePayload.fluid_type_at_rupture]
    : null;

  return (
    <div className="space-y-2">
      {ruptureEvent && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Bolsa rota{ruptureTypeLabel ? ` (${ruptureTypeLabel})` : ""}</span>
            <span className="whitespace-nowrap text-muted-foreground text-xs">
              {dayjs(ruptureEvent.occurredAt).format("HH:mm")}
            </span>
          </div>
          {ruptureFluidLabel && (
            <p className="mt-1 text-muted-foreground text-xs">
              Líquido: {ruptureFluidLabel.toLowerCase()}
            </p>
          )}
        </div>
      )}

      {fluidEvents.length > 0 && (
        <div className="divide-y divide-border">
          {fluidEvents.map((event) => {
            const { fluid_type } = event.payload as { fluid_type: string };
            return (
              <div key={event.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>Líquido amniótico: {AMNIOTIC_FLUID_TYPE_LABELS[fluid_type] ?? fluid_type}</span>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {dayjs(event.occurredAt).format("HH:mm")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
