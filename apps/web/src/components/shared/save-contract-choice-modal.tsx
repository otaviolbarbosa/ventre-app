"use client";

import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";

interface SaveContractChoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSaveCurrent: () => void;
  onCreateNew: () => void;
}

export function SaveContractChoiceModal({
  open,
  onOpenChange,
  isPending,
  onSaveCurrent,
  onCreateNew,
}: SaveContractChoiceModalProps) {
  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar modelo de contrato"
      description="Deseja salvar as alterações no modelo atual ou criar um novo modelo de contrato?"
    >
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCreateNew}
          disabled={isPending}
          className="flex-1"
        >
          Criar novo modelo
        </Button>
        <Button type="button" onClick={onSaveCurrent} disabled={isPending} className="flex-1">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar no modelo atual
        </Button>
      </div>
    </ContentModal>
  );
}
