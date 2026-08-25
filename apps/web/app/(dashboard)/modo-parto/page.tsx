"use client";

import { getActiveBirthModePregnancyAction } from "@/actions/get-active-birth-mode-pregnancy-action";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { BirthModeScreen } from "@/screens/birth-mode-screen";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Skeleton } from "@ventre/ui/skeleton";
import { HeartHandshake } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect } from "react";

export default function ModoPartoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pregnancyId = searchParams.get("pregnancyId");

  const { isDoula } = useAuth();
  const disableBirthModeForDoulas = useFeatureFlagEnabled("disable-birth-mode-for-doulas");
  const birthModeDisabled = isDoula && !!disableBirthModeForDoulas;

  const {
    execute: fetchActivePregnancies,
    result,
    isPending,
  } = useAction(getActiveBirthModePregnancyAction);

  useEffect(() => {
    if (birthModeDisabled) {
      router.replace("/home?error=acesso-negado");
      return;
    }
    fetchActivePregnancies();
  }, [fetchActivePregnancies, birthModeDisabled, router]);

  const activePregnancies = result.data?.pregnancies ?? [];

  if (birthModeDisabled) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (pregnancyId) {
    const current = activePregnancies.find((p) => p.id === pregnancyId);
    return (
      <BirthModeScreen
        pregnancyId={pregnancyId}
        patientName={(current?.patient as { name: string } | null)?.name ?? "Gestante"}
      />
    );
  }

  if (isPending) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (activePregnancies.length === 0) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title="Nenhum parto ativo no momento"
        description="Quando o Modo Parto for ativado para uma paciente da sua equipe, ele aparecerá aqui."
      />
    );
  }

  const onlyActivePregnancy = activePregnancies.length === 1 ? activePregnancies[0] : undefined;
  if (onlyActivePregnancy) {
    return (
      <BirthModeScreen
        pregnancyId={onlyActivePregnancy.id}
        patientName={(onlyActivePregnancy.patient as { name: string } | null)?.name ?? ""}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-4 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
      <p className="text-muted-foreground text-sm">
        Mais de um parto ativo na sua equipe. Selecione qual acompanhar:
      </p>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {activePregnancies.map((pregnancy) => (
            <div key={pregnancy.id} className="flex items-center justify-between gap-2 p-4">
              <span className="font-medium text-sm">
                {(pregnancy.patient as { name: string } | null)?.name ?? "Gestante"}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push(`/modo-parto?pregnancyId=${pregnancy.id}`)}
              >
                Acompanhar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
