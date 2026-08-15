"use client";

import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { createContractChangeRequestAction } from "@/actions/create-contract-change-request-action";
import { cn } from "@/lib/utils";

export function RequestContractChangeDialog({
  patientId,
  triggerLabel = "Solicitar alteração",
}: {
  patientId: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messageHtml, setMessageHtml] = useState("");
  const [hasError, setHasError] = useState(false);

  const { execute, isExecuting } = useAction(createContractChangeRequestAction, {
    onSuccess: () => {
      toast.success("Solicitação de alteração enviada.");
      setMessageHtml("");
      setOpen(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao enviar solicitação. Tente novamente.");
    },
  });

  function handleSubmit() {
    const isEmpty = messageHtml.replace(/<[^>]*>/g, "").trim().length === 0;
    if (isEmpty) {
      setHasError(true);
      return;
    }
    setHasError(false);
    execute({ patientId, messageHtml });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <ContentModal
        open={open}
        onOpenChange={setOpen}
        title="Solicitar alteração no contrato"
        description="Descreva o que gostaria de alterar antes de assinar o contrato."
        contentClassName="sm:max-w-[520px]"
      >
        <div className="space-y-3 pt-2">
          <RichEditor
            content={messageHtml}
            onChange={(html) => {
              setMessageHtml(html);
              if (hasError) setHasError(false);
            }}
            placeholder="Descreva a alteração desejada..."
            className={cn("max-h-[300px] min-h-[150px] bg-white", hasError && "border-destructive")}
          />
          {hasError && <p className="text-destructive text-sm">A mensagem não pode estar vazia</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={isExecuting} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isExecuting} onClick={handleSubmit}>
              {isExecuting ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </div>
        </div>
      </ContentModal>
    </>
  );
}
