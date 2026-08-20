"use client";

import { getBirthModeTimelineAction } from "@/actions/get-birth-mode-timeline-action";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BirthModeRegisterButtons } from "@/components/shared/birth-mode-register-buttons";
import { BirthModeTimeline } from "@/components/shared/birth-mode-timeline";
import { useBirthModeTimelineRealtime } from "@/hooks/use-birth-mode-timeline-realtime";
import { Badge } from "@ventre/ui/badge";
import { Skeleton } from "@ventre/ui/skeleton";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

type BirthModeScreenProps = {
  pregnancyId: string;
  patientName: string;
};

export function BirthModeScreen({ pregnancyId, patientName }: BirthModeScreenProps) {
  const [events, setEvents] = useState<BirthModeTimelineEvent[]>([]);
  const professionalNamesRef = useRef<Map<string, string>>(new Map());

  const { execute: fetchTimeline, isPending } = useAction(getBirthModeTimelineAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      setEvents(data.events);
      for (const event of data.events) {
        if (event.professionalId) {
          professionalNamesRef.current.set(event.professionalId, event.professionalName);
        }
      }
    },
  });

  useEffect(() => {
    fetchTimeline({ pregnancyId });
  }, [fetchTimeline, pregnancyId]);

  const resolveProfessionalName = useCallback(
    (professionalId: string) => professionalNamesRef.current.get(professionalId) ?? "Profissional",
    [],
  );

  const onNewEvent = useCallback((event: BirthModeTimelineEvent) => {
    setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
  }, []);

  useBirthModeTimelineRealtime(pregnancyId, resolveProfessionalName, onNewEvent);

  return (
    <div className="flex flex-1 flex-col space-y-4 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-poppins font-semibold text-lg">{patientName}</h1>
        <Badge variant="warning" className="gap-1.5">
          Modo Parto Ativo
        </Badge>
      </div>

      <BirthModeRegisterButtons pregnancyId={pregnancyId} onSuccess={() => fetchTimeline({ pregnancyId })} />

      {isPending && events.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <BirthModeTimeline events={events} />
      )}
    </div>
  );
}
