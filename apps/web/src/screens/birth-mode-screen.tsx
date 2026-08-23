"use client";

import { exportPartographPdfAction } from "@/actions/export-partograph-pdf-action";
import { getBirthModeTimelineAction } from "@/actions/get-birth-mode-timeline-action";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BirthModePartograph } from "@/components/shared/birth-mode-partograph";
import { BirthModeRegisterButtons } from "@/components/shared/birth-mode-register-buttons";
import { BirthModeTimeline } from "@/components/shared/birth-mode-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishCareModal } from "@/components/shared/finish-care-modal";
import { useBirthModeTimelineRealtime } from "@/hooks/use-birth-mode-timeline-realtime";
import { computeContractionsPer10Min } from "@/lib/birth-mode-chart-utils";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Skeleton } from "@ventre/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";
import { CheckCircle2, FileDown, HeartHandshake, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
    setEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      const next = [...prev, event];
      if (event.type !== "contraction") return next;

      const contractionEvents = next
        .filter((e) => e.type === "contraction")
        .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      const frequencyById = computeContractionsPer10Min(contractionEvents);

      return next.map((e) =>
        e.type === "contraction"
          ? {
              ...e,
              payload: { ...e.payload, contractions_per_10min: frequencyById.get(e.id) ?? null },
            }
          : e,
      );
    });
  }, []);

  useBirthModeTimelineRealtime(pregnancyId, resolveProfessionalName, onNewEvent);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { execute: exportPdf } = useAction(exportPartographPdfAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      const byteChars = atob(data.pdfBase64);
      const byteNumbers = Array.from(byteChars, (c) => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao gerar PDF do partograma");
    },
    onExecute: () => setIsExportingPdf(true),
    onSettled: () => setIsExportingPdf(false),
  });

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
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isExportingPdf}
          onClick={() => exportPdf({ pregnancyId })}
        >
          {isExportingPdf ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {isExportingPdf ? "Gerando PDF..." : "Exportar PDF"}
        </Button>
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

      {!hasFinished && (
        <BirthModeRegisterButtons
          pregnancyId={pregnancyId}
          events={events}
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
        <Tabs defaultValue="partograph">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="partograph">Partograma</TabsTrigger>
            <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          </TabsList>
          <TabsContent value="partograph">
            <BirthModePartograph events={events} />
          </TabsContent>
          <TabsContent value="timeline">
            <BirthModeTimeline events={events} />
          </TabsContent>
        </Tabs>
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
