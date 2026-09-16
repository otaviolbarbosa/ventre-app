"use client";

import { ErrorState } from "@/components/shared/error-state";
import { TriangleAlert } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      code="500"
      icon={TriangleAlert}
      title="Algo saiu do previsto"
      subtitle="Nossa equipe já foi avisada. Tente novamente em alguns instantes."
      primaryLabel="Tentar novamente"
      onPrimary={reset}
    />
  );
}
