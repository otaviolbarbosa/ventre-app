"use client";

import { addBirthMembraneRuptureAction } from "@/actions/add-birth-membrane-rupture-action";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

type AddBirthMembraneRuptureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthMembraneRuptureModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthMembraneRuptureModalProps) {
  const { executeAsync: addRupture, isPending } = useAction(addBirthMembraneRuptureAction);

  async function handleConfirm() {
    const result = await addRupture({ pregnancyId, data: {} });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Bolsa rota registrada!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Bolsa Rota"
      description="Confirme que a bolsa rompeu agora. Este registro é único por parto."
    >
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" className="gradient-primary" disabled={isPending} onClick={handleConfirm}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar
        </Button>
      </div>
    </ContentModal>
  );
}
