"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/shared/error-state";

export default function NotFound() {
  const router = useRouter();

  return (
    <ErrorState
      code="404"
      title="Essa página não está mais aqui"
      subtitle="Vamos te levar de volta ao cuidado das suas gestantes."
      primaryLabel="Voltar à página anterior"
      onPrimary={() => router.back()}
    />
  );
}
