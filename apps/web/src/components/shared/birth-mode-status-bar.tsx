"use client";

import { useBirthModeRealtimeContext } from "@/providers/birth-mode-realtime-provider";
import { Button } from "@ventre/ui/button";
import { HeartHandshake } from "lucide-react";
import { useRouter } from "next/navigation";

export function BirthModeStatusBar() {
  const router = useRouter();
  const { showBar, pendingActivation, activePregnancies, cancelRedirect, goNow } =
    useBirthModeRealtimeContext();

  if (!showBar) return null;

  const relevantPregnancy = activePregnancies.find(
    (p) => p.id === (pendingActivation?.pregnancyId ?? activePregnancies[0]?.id),
  );
  const patientName = (relevantPregnancy?.patient as { name: string } | null)?.name ?? "uma paciente";

  if (pendingActivation) {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            Modo Parto ativado para {patientName} — redirecionando em {pendingActivation.secondsLeft}s
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" onClick={goNow}>
            Ir agora
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelRedirect}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  const target =
    activePregnancies.length === 1 && activePregnancies[0]
      ? `/modo-parto?pregnancyId=${activePregnancies[0].id}`
      : "/modo-parto";

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 shrink-0" />
        <p className="text-sm">Modo Parto ativo — {patientName}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => router.push(target)}>
        Voltar
      </Button>
    </div>
  );
}
