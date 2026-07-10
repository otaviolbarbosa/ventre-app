"use client";

import { sendPatientInviteEmailAction } from "@/actions/send-patient-invite-email-action";
import CustomIcon from "@/components/shared/custom-icon";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Button } from "@ventre/ui/button";
import { Check, Copy, Loader2, Mail } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

type PatientInviteShareModal = {
  inviteId: string;
  patientName: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onClose?: VoidFunction;
};

export default function PatientInviteShareModal({
  inviteId,
  patientName,
  isOpen,
  setIsOpen,
  onClose,
}: PatientInviteShareModal) {
  const [isCopied, setIsCopied] = useState(false);

  const { executeAsync: executeSendEmail, isPending: isSendingEmail } = useAction(
    sendPatientInviteEmailAction,
  );

  function handleCloseModal() {
    setIsOpen(false);
    setIsCopied(false);
    onClose?.();
  }

  function getInviteUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/patient-registration?piid=${inviteId}`;
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(getInviteUrl());
    setIsCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setIsCopied(false), 2000);
  }

  function handleShareWhatsApp() {
    const message = `Olá, ${patientName}! Você foi convidada a criar sua conta no Ventre para acompanhar seu pré-natal. Acesse o link: ${getInviteUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  async function handleSendEmail() {
    const result = await executeSendEmail({ inviteId });

    if (!result?.data?.success) {
      toast.error(result?.serverError ?? "Erro ao enviar e-mail");
      return;
    }

    toast.success("E-mail de convite enviado!");
    handleCloseModal();
  }

  return (
    <ContentModal open={isOpen} onOpenChange={handleCloseModal} title="Convite enviado">
      <div className="space-y-4 pt-2">
        <p className="text-muted-foreground text-sm">
          Compartilhe o link de auto cadastro com {patientName}.
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
        <Button
          variant="outline"
          className="w-full"
          disabled={isSendingEmail}
          onClick={handleSendEmail}
        >
          {isSendingEmail ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Enviar por e-mail
        </Button>
      </div>
    </ContentModal>
  );
}
