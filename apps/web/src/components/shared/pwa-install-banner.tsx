"use client";

import { Button } from "@ventre/ui/button";
import { Download, X } from "lucide-react";
import { useState } from "react";
import { usePwa } from "@/providers/pwa-provider";

export function PwaInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || isInstalled || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-background px-4 py-6 shadow-lg sm:right-4 sm:bottom-4 sm:left-auto sm:max-w-sm sm:rounded-xl sm:border sm:p-4">
      <p className="text-sm">Instale o app para acesso rápido em seu dispositivo.</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={() => promptInstall()}>
          <Download />
          Instalar
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          aria-label="Fechar"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
