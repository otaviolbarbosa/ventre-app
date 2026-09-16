"use client";

import { ErrorState } from "@/components/shared/error-state";
import { useCallback, useEffect, useState } from "react";

export default function OfflinePage() {
  const [attempt, setAttempt] = useState(1);

  const retry = useCallback(() => {
    if (navigator.onLine) window.location.reload();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setAttempt((n) => n + 1);
      retry();
    }, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
    };
  }, [retry]);

  return (
    <ErrorState
      code="OFF"
      // icon={WifiOff}
      title="Você está sem conexão"
      subtitle="Estamos tentando reconectar. Seus dados continuam salvos."
      primaryLabel="Tentar agora"
      onPrimary={() => window.location.reload()}
      slot={
        <div className="-mt-3.5 mb-[22px] inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-secondary-foreground">
          <span className="size-[7px] animate-pulse rounded-full bg-primary" />
          Reconectando… tentativa {attempt}
        </div>
      }
    />
  );
}
