"use client";

import { ErrorState } from "@/components/shared/error-state";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <ErrorState
      code="404"
      // icon={FileX}
      title="Essa página não está mais aqui"
      subtitle="Vamos te levar de volta ao cuidado das suas gestantes."
      primaryLabel="Voltar à página anterior"
      onPrimary={() => router.back()}
    />
  );
}
