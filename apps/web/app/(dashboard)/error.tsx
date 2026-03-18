"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-semibold text-lg">Algo deu errado</p>
      <p className="text-muted-foreground text-sm">
        Ocorreu um erro inesperado. Por favor, tente novamente.
      </p>
      <Button onClick={reset}>Tentar Novamente</Button>
    </div>
  );
}
