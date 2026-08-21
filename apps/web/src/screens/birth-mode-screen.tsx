"use client";

import { getBirthModeTimelineAction } from "@/actions/get-birth-mode-timeline-action";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BirthModeRegisterButtons } from "@/components/shared/birth-mode-register-buttons";
import { BirthModeTimeline } from "@/components/shared/birth-mode-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishCareModal } from "@/components/shared/finish-care-modal";
import { useBirthModeTimelineRealtime } from "@/hooks/use-birth-mode-timeline-realtime";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Skeleton } from "@ventre/ui/skeleton";
import { CheckCircle2, HeartHandshake } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

type BirthModeScreenProps = {
  pregnancyId: string;
  patientName: string;
};

export function BirthModeScreen({
  pregnancyId,
  patientName: initialPatientName,
}: BirthModeScreenProps) {
  const [events, setEvents] = useState<BirthModeTimelineEvent[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState(initialPatientName);
  const [hasFinished, setHasFinished] = useState(false);
  const [wasActivated, setWasActivated] = useState<boolean | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const professionalNamesRef = useRef<Map<string, string>>(new Map());

  const { execute: fetchTimeline, isPending } = useAction(getBirthModeTimelineAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      setEvents(data.events);
      if (data.patientId) setPatientId(data.patientId);
      if (data.patientName) setPatientName(data.patientName);
      setHasFinished(data.hasFinished);
      setWasActivated(data.wasActivated);
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

  if (isPending && wasActivated === null) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (wasActivated === false) {
    return (
      <div className="flex flex-1 flex-col space-y-4 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
        <EmptyState
          icon={HeartHandshake}
          title="Modo Parto não ativado"
          description="Esta gestação não teve o Modo Parto ativado."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-4 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
      <div className="flex items-start justify-between gap-2 sm:items-center">
        <h1 className="font-poppins font-semibold text-lg">{patientName}</h1>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {hasFinished ? (
            <Badge variant="secondary" className="gap-1.5">
              Parto Finalizado
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1.5">
              Modo Parto Ativo
            </Badge>
          )}
          {!hasFinished && patientId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => setShowFinishModal(true)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Registrar Nascimento
            </Button>
          )}
        </div>
      </div>

      {!hasFinished && (
        <BirthModeRegisterButtons
          pregnancyId={pregnancyId}
          onSuccess={() => fetchTimeline({ pregnancyId })}
        />
      )}

      {isPending && events.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <BirthModeTimeline events={events} />
      )}

      {patientId && (
        <FinishCareModal
          open={showFinishModal}
          onOpenChange={setShowFinishModal}
          patientId={patientId}
          pregnancyId={pregnancyId}
          onSuccess={() => fetchTimeline({ pregnancyId })}
        />
      )}
    </div>
  );
}
