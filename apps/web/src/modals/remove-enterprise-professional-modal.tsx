"use client";

import { removeEnterpriseProfessionalAction } from "@/actions/remove-enterprise-professional-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Button } from "@ventre/ui/button";
import type { EnterpriseProfessional } from "@/services/professional";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type RemoveEnterpriseProfessionalModalProps = {
  professional: EnterpriseProfessional | null;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export default function RemoveEnterpriseProfessionalModal({
  professional,
  showModal,
  setShowModal,
  onSuccess,
}: RemoveEnterpriseProfessionalModalProps) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    if (!professional) return;
    setIsRemoving(true);
    try {
      const result = await removeEnterpriseProfessionalAction({
        professionalId: professional.id,
      });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(`${professional.name ?? "Profissional"} removido da organização.`);
      onSuccess?.();
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("Erro ao remover profissional.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title="Remover profissional"
      description={`Tem certeza que deseja remover ${professional?.name ?? "este profissional"} da organização? Ele perderá o acesso às funcionalidades da organização.`}
    >
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => setShowModal(false)} disabled={isRemoving}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
          {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Remover
        </Button>
      </div>
    </ContentModal>
  );
}
