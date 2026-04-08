"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  "acesso-negado": "Você não tem permissão para acessar essa página.",
};

export function FlashMessage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;

    const message = ERROR_MESSAGES[error] ?? "Ocorreu um erro inesperado.";
    toast.error(message);

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    router.replace(url.pathname + (url.search || ""));
  }, [searchParams, router]);

  return null;
}
