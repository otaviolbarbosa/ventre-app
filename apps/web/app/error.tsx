"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      code="500"
      title="Algo saiu do previsto"
      subtitle="Nossa equipe já foi avisada. Tente novamente em alguns instantes."
      primaryLabel="Tentar novamente"
      onPrimary={reset}
    />
  );
}
