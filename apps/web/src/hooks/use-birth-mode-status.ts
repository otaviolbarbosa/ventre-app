"use client";

import { getActiveBirthModePregnancyAction } from "@/actions/get-active-birth-mode-pregnancy-action";
import { useAuth } from "@/hooks/use-auth";
import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";
import {
  canConsiderAutoRedirect,
  resolveAutoRedirectPregnancyId,
} from "@/lib/birth-mode-redirect-utils";
import { usePathname, useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";

type ActiveBirthModePregnancy = NonNullable<
  Awaited<ReturnType<typeof getActiveBirthModePregnancyAction>>["data"]
>["pregnancies"][number];

type PendingActivation = {
  pregnancyId: string;
  secondsLeft: number;
  reason: "activation" | "inactivity";
};

const COUNTDOWN_SECONDS = 10;
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000;

export function useBirthModeStatus() {
  const { user, isProfessional, isDoula } = useAuth();
  const disableBirthModeForDoulas = useFeatureFlagEnabled("disable-birth-mode-for-doulas");
  const birthModeDisabled = isDoula && !!disableBirthModeForDoulas;
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
    if (!lastActivation || !user || birthModeDisabled) return;
    if (seenActivationIds.current.has(lastActivation.id)) return;
    seenActivationIds.current.add(lastActivation.id);
    if (pathname?.startsWith("/modo-parto")) return;

    fetchActive();
    setPendingActivation({
      pregnancyId: lastActivation.id,
      secondsLeft: COUNTDOWN_SECONDS,
      reason: "activation",
    });
  }, [lastActivation, user, pathname, fetchActive, birthModeDisabled]);

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

  const hasCheckedInitialRedirect = useRef(false);

  // Checagem no mount — equivale a "abrir o app com parto já ativo"
  useEffect(() => {
    if (hasCheckedInitialRedirect.current) return;
    if (!user) return;

    let cancelled = false;
    (async () => {
      const result = await getActiveBirthModePregnancyAction();
      if (cancelled || hasCheckedInitialRedirect.current) return;
      hasCheckedInitialRedirect.current = true;
      const pregnancies = result?.data?.pregnancies ?? [];
      setActivePregnancies(pregnancies);
      const ids = pregnancies.map((p) => p.id);
      if (
        canConsiderAutoRedirect({ isProfessional, birthModeDisabled, pathname, activePregnancyIds: ids })
      ) {
        const id = resolveAutoRedirectPregnancyId(ids);
        if (id) router.push(`/modo-parto?pregnancyId=${id}`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: checagem única por mount — só `user` deve disparar; pathname/isProfessional/birthModeDisabled são lidos no momento da resolução via closure, não devem reexecutar o fetch inicial
  }, [user]);

  // Retorno do background — visibilitychange + pageshow como fallback (bug conhecido do Safari/iOS)
  useEffect(() => {
    if (typeof document === "undefined" || !user) return;

    async function checkOnForeground() {
      const result = await getActiveBirthModePregnancyAction();
      const pregnancies = result?.data?.pregnancies ?? [];
      setActivePregnancies(pregnancies);
      const ids = pregnancies.map((p) => p.id);
      if (
        canConsiderAutoRedirect({ isProfessional, birthModeDisabled, pathname, activePregnancyIds: ids })
      ) {
        const id = resolveAutoRedirectPregnancyId(ids);
        if (id) router.push(`/modo-parto?pregnancyId=${id}`);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkOnForeground();
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) checkOnForeground();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [user, isProfessional, birthModeDisabled, pathname, router]);

  const activePregnanciesRef = useRef(activePregnancies);
  useEffect(() => {
    activePregnanciesRef.current = activePregnancies;
  }, [activePregnancies]);

  // Timer de inatividade de 2min — últimos 10s viram a contagem regressiva cancelável (mesmo pendingActivation)
  useEffect(() => {
    const ids = activePregnancies.map((p) => p.id);
    const canRedirect = canConsiderAutoRedirect({
      isProfessional,
      birthModeDisabled,
      pathname,
      activePregnancyIds: ids,
    });
    if (!canRedirect) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleInactivityRedirect() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setPendingActivation((prev) => {
          if (prev) return prev;
          const id = resolveAutoRedirectPregnancyId(activePregnanciesRef.current.map((p) => p.id));
          if (!id) return prev;
          return { pregnancyId: id, secondsLeft: COUNTDOWN_SECONDS, reason: "inactivity" };
        });
      }, INACTIVITY_TIMEOUT_MS - COUNTDOWN_MS);
    }

    const activityEvents: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll"];
    for (const event of activityEvents) {
      window.addEventListener(event, scheduleInactivityRedirect, { passive: true });
    }
    scheduleInactivityRedirect();

    return () => {
      clearTimeout(timeoutId);
      for (const event of activityEvents) {
        window.removeEventListener(event, scheduleInactivityRedirect);
      }
    };
  }, [isProfessional, birthModeDisabled, pathname, activePregnancies]);

  const cancelRedirect = useCallback(() => setPendingActivation(null), []);

  const goNow = useCallback(() => {
    setPendingActivation((prev) => {
      if (!prev) return prev;
      router.push(`/modo-parto?pregnancyId=${prev.pregnancyId}`);
      return null;
    });
  }, [router]);

  const showBar =
    isProfessional &&
    !birthModeDisabled &&
    activePregnancies.length > 0 &&
    !pathname?.startsWith("/modo-parto");

  return { activePregnancies, pendingActivation, cancelRedirect, goNow, showBar };
}
