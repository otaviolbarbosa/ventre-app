"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ContractErrorToast({ show }: { show: boolean }) {
  useEffect(() => {
    if (show) toast.error("Documento não encontrado ou excluído");
  }, [show]);

  return null;
}
