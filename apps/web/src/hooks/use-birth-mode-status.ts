"use client";

import { getActiveBirthModePregnancyAction } from "@/actions/get-active-birth-mode-pregnancy-action";
import { useAuth } from "@/hooks/use-auth";
import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ActiveBirthModePregnancy = NonNullable<
  Awaited<ReturnType<typeof getActiveBirthModePregnancyAction>>["data"]
>["pregnancies"][number];

type PendingActivation = {
  pregnancyId: string;
  secondsLeft: number;
};

const COUNTDOWN_SECONDS = 10;

export function useBirthModeStatus() {
  const { user, isProfessional } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { lastActivation } = useBirthModeRealtime();

  const [activePregnancies, setActivePregnancies] = useState<ActiveBirthModePregnancy[]>([]);
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null);
  const seenActivationIds = useRef(new Set<string>());

  const fetchActive = useCallback(async () => {
    const result = await getActiveBirthModePregnancyAction();
    if (result?.data) setActivePregnancies(result.data.pregnancies);
  }, []);

  // Polling 60s — mirror use-notifications.ts:25-38. É a única fonte confiável de
  // "a barra deve sumir", já que o filtro Realtime abaixo não dispara em desativação.
  useEffect(() => {
    if (!user) return;
    fetchActive();
    const interval = setInterval(fetchActive, 60_000);
    return () => clearInterval(interval);
  }, [user, fetchActive]);

  // Nova ativação vinda do canal Realtime -> dispara a contagem regressiva
  useEffect(() => {
    if (!lastActivation || !user) return;
    if (seenActivationIds.current.has(lastActivation.id)) return;
    seenActivationIds.current.add(lastActivation.id);
    if (pathname?.startsWith("/modo-parto")) return;

    fetchActive();
    setPendingActivation({ pregnancyId: lastActivation.id, secondsLeft: COUNTDOWN_SECONDS });
  }, [lastActivation, user, pathname, fetchActive]);

  // Tick da contagem regressiva — depende só do pregnancyId (não do objeto inteiro)
  // para não recriar o interval a cada decremento de secondsLeft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só o pregnancyId deve reiniciar o interval — secondsLeft é atualizado via updater function, não precisa disparar o effect
  useEffect(() => {
    if (!pendingActivation) return;

    const interval = setInterval(() => {
      setPendingActivation((prev) => {
        if (!prev) return prev;
        if (prev.secondsLeft <= 1) {
          router.push(`/modo-parto?pregnancyId=${prev.pregnancyId}`);
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingActivation?.pregnancyId, router]);

  const cancelRedirect = useCallback(() => setPendingActivation(null), []);

  const goNow = useCallback(() => {
    setPendingActivation((prev) => {
      if (!prev) return prev;
      router.push(`/modo-parto?pregnancyId=${prev.pregnancyId}`);
      return null;
    });
  }, [router]);

  const showBar = isProfessional && activePregnancies.length > 0 && !pathname?.startsWith("/modo-parto");

  return { activePregnancies, pendingActivation, cancelRedirect, goNow, showBar };
}
