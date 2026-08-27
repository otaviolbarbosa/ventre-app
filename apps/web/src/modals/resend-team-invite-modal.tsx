"use client";

import CustomIcon from "@/components/shared/custom-icon";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ResendTeamInviteModalProps = {
  inviteId: string;
  patientName: string;
  isReactivated: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function ResendTeamInviteModal({
  inviteId,
  patientName,
  isReactivated,
  isOpen,
  setIsOpen,
}: ResendTeamInviteModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  function handleCloseModal() {
    setIsOpen(false);
    setIsCopied(false);
  }

  function getInviteUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invites/${inviteId}`;
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(getInviteUrl());
    setIsCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setIsCopied(false), 2000);
  }

  function handleShareWhatsApp() {
    const message = `Olá! Estou te convidando para participar da uma equipe de cuidado de ${patientName} no VentreApp. Acesse o link para ver o convite: ${getInviteUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <ContentModal open={isOpen} onOpenChange={handleCloseModal} title="Reenviar convite">
      <div className="space-y-4 pt-2">
        <p className="text-muted-foreground text-sm">
          {isReactivated && "O convite foi reativado. "}Compartilhe o link novamente com a
          profissional.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
            {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {isCopied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleShareWhatsApp}>
            <CustomIcon icon="whatsapp" className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
