"use client";

import { addEnterpriseProfessionalAction } from "@/actions/add-enterprise-professional-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type AddEnterpriseProfessionalModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export default function AddEnterpriseProfessionalModal({
  showModal,
  setShowModal,
  onSuccess,
}: AddEnterpriseProfessionalModalProps) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd() {
    if (!emailInput.trim()) return;
    setIsAdding(true);
    try {
      const result = await addEnterpriseProfessionalAction({ email: emailInput.trim() });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(`${result?.data?.name ?? "Profissional"} adicionado com sucesso!`);
      setEmailInput("");
      onSuccess?.();
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("Erro ao adicionar profissional.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={(open) => {
        if (!open) setEmailInput("");
        setShowModal(open);
      }}
      title="Adicionar Profissional"
      description="Informe o e-mail de um profissional já cadastrado na plataforma para associá-lo à sua organização."
    >
      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="enterprise-email-input">E-mail do profissional</Label>
          <Input
            id="enterprise-email-input"
            type="email"
            placeholder="profissional@exemplo.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => setShowModal(false)} disabled={isAdding}>
          Cancelar
        </Button>
        <Button
          className="gradient-primary"
          onClick={handleAdd}
          disabled={!emailInput.trim() || isAdding}
        >
          {isAdding ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
    </ContentModal>
  );
}
