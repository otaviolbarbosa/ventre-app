"use client";

import { upsertEmotionalPrenatalAction } from "@/actions/upsert-emotional-prenatal-action";
import type { EmotionalPrenatalInput } from "@/lib/validations/prenatal";
import { Button } from "@ventre/ui/button";
import { Label } from "@ventre/ui/label";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type EditEmotionalPrenatalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  questionName: keyof EmotionalPrenatalInput;
  question: string;
  currentValue: string | null | undefined;
  onSuccess: () => void;
};

export function EditEmotionalPrenatalModal({
  open,
  onOpenChange,
  pregnancyId,
  questionName,
  question,
  currentValue,
  onSuccess,
}: EditEmotionalPrenatalModalProps) {
  const { executeAsync, isPending } = useAction(upsertEmotionalPrenatalAction);
  const [answer, setAnswer] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      setAnswer(currentValue ?? "");
    }
  }, [open, currentValue]);

  async function handleSubmit() {
    const result = await executeAsync({
      pregnancyId,
      data: { [questionName]: answer } as EmotionalPrenatalInput,
    });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Pré-natal emocional atualizado!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Pré-natal Emocional"
      description="Registre a resposta desta pergunta do roteiro de escuta emocional"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{question}</Label>
          <Textarea
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gradient-primary"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
