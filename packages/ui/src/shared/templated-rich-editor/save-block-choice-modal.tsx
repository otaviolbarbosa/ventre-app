"use client";

import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";

interface SaveBlockChoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  canOverwrite: boolean;
  onSaveCurrent: () => void;
  onCreateNew: () => void;
}

export function SaveBlockChoiceModal({
  open,
  onOpenChange,
  isPending,
  canOverwrite,
  onSaveCurrent,
  onCreateNew,
}: SaveBlockChoiceModalProps) {
  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar modelo"
      description="Deseja sobrescrever o modelo atual ou criar um novo?"
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
        {canOverwrite && (
          <Button type="button" onClick={onSaveCurrent} disabled={isPending} className="flex-1">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sobrescrever modelo atual
          </Button>
        )}
      </div>
    </ContentModal>
  );
}
