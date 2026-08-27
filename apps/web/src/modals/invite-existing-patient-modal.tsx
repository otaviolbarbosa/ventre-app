"use client";

import { createLinkExistingPatientInviteAction } from "@/actions/create-link-existing-patient-invite-action";
import PatientInviteShareModal from "@/modals/patient-invite-share-modal";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Button } from "@ventre/ui/button";
import type { Tables } from "@ventre/supabase";
import { Loader2, UserPlus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

type InviteExistingPatientModal = {
  patient: Tables<"patients">;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onClose?: VoidFunction;
};

export default function InviteExistingPatientModal({
  patient,
  isOpen,
  setIsOpen,
  onClose,
}: InviteExistingPatientModal) {
  const [createdInvite, setCreatedInvite] = useState<{ id: string; name: string } | null>(null);

  const { execute, status } = useAction(createLinkExistingPatientInviteAction, {
    onSuccess: ({ data }) => {
      if (!data?.invite) return;
      setCreatedInvite({ id: data.invite.id, name: data.invite.name ?? patient.name });
      handleCloseModal();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar convite");
    },
  });

  const isCreating = status === "executing";

  function handleCloseModal() {
    setIsOpen(false);
    onClose?.();
  }

  return (
    <>
      <ContentModal open={isOpen} onOpenChange={handleCloseModal} title="Convidar Gestante">
        <div className="space-y-4 pt-2">
          <p className="text-muted-foreground text-sm">
            {patient.name} poderá criar sua própria conta para acompanhar o cartão pré-natal, a
            agenda e o financeiro.
          </p>
          <Button
            className="gradient-primary w-full"
            disabled={isCreating}
            onClick={() => execute({ patientId: patient.id })}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Gerar convite
          </Button>
        </div>
      </ContentModal>

      {createdInvite && (
        <PatientInviteShareModal
          inviteId={createdInvite.id}
          patientName={createdInvite.name}
          isOpen={!!createdInvite}
          setIsOpen={(open) => {
            if (!open) setCreatedInvite(null);
          }}
        />
      )}
    </>
  );
}
