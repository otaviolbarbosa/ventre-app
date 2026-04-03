"use client";

import { createInviteAction } from "@/actions/create-invite-action";
import { inviteProfessionalDirectAction } from "@/actions/invite-professional-direct-action";
import { searchUsersAction } from "@/actions/search-users-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import CustomIcon from "@/components/shared/custom-icon";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import type { ProfessionalType } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import type { Tables } from "@ventre/supabase";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SearchedUser = {
  id: string;
  name: string;
  email: string;
  professional_type: string;
};

type InviteProfessionalModal = {
  patient: Tables<"patients">;
  availableTypes: ProfessionalType[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onClose?: VoidFunction;
};

export default function InviteProfessionalModal({
  patient,
  availableTypes,
  isOpen,
  setIsOpen,
  onClose,
}: InviteProfessionalModal) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<SearchedUser | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { executeAsync: executeInviteDirect, isPending: isInviting } = useAction(
    inviteProfessionalDirectAction,
  );
  const { executeAsync: executeInviteLink, isPending: isLinkPending } =
    useAction(createInviteAction);
  const { executeAsync: executeSearch, isPending: isLoading } = useAction(searchUsersAction);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await executeSearch({
        query: searchQuery,
        types: availableTypes.length > 0 ? availableTypes : undefined,
      });
      setResults((res?.data?.users ?? []) as SearchedUser[]);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, availableTypes, executeSearch]);

  function handleCloseModal() {
    setIsOpen(false);
    setSearchQuery("");
    setResults([]);
    setSelectedProfessional(null);
    setIsCopied(false);
    onClose?.();
  }

  function handleSelect(user: SearchedUser) {
    setSelectedProfessional(user);
    setSearchQuery("");
    setResults([]);
  }

  function clearSelection() {
    setSelectedProfessional(null);
    setSearchQuery("");
  }

  async function handleInvite() {
    if (!selectedProfessional) return;

    const result = await executeInviteDirect({
      patientId: patient.id,
      professionalId: selectedProfessional.id,
    });

    if (!result?.data?.invite) {
      toast.error(result?.serverError ?? "Erro ao enviar convite");
      return;
    }

    toast.success(`Convite enviado para ${selectedProfessional.name}`);
    handleCloseModal();
  }

  function getInviteUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invites`;
  }

  async function handleCopyLink() {
    const result = await executeInviteLink({ patientId: patient.id });

    if (!result?.data?.invite) {
      toast.error(result?.serverError ?? "Erro ao criar convite");
      return;
    }

    navigator.clipboard.writeText(`${getInviteUrl()}/${result.data.invite.id}`);
    setIsCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setIsCopied(false), 2000);
    handleCloseModal();
  }

  async function handleShareWhatsApp() {
    const result = await executeInviteLink({ patientId: patient.id });

    if (!result?.data?.invite) {
      toast.error(result?.serverError ?? "Erro ao criar convite");
      return;
    }

    const inviteUrl = getInviteUrl();
    const message = `Olá! Estou te convidando para participar da uma equipe de cuidado de ${patient.name} no VentreApp. Acesse o link para ver o convite: ${inviteUrl}/${result.data.invite.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <ContentModal open={isOpen} onOpenChange={handleCloseModal} title="Convidar Profissional">
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          {selectedProfessional ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
              <div>
                <p className="font-medium text-sm">{selectedProfessional.name}</p>
                <p className="text-muted-foreground text-xs">
                  {selectedProfessional.email}
                  {" · "}
                  {professionalTypeLabels[selectedProfessional.professional_type] ??
                    selectedProfessional.professional_type}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Label>Buscar profissional</Label>

              <div className="relative">
                <Input
                  placeholder="Nome ou email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
                {isLoading && (
                  <div className="-translate-y-1/2 absolute top-1/2 right-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && results.length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-card shadow-md">
                    {results.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(user);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{user.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {professionalTypeLabels[user.professional_type] ??
                              user.professional_type}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs">{user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!isLoading && searchQuery.length >= 2 && results.length === 0 && (
                  <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-card px-3 py-4 shadow-md">
                    <p className="text-center text-muted-foreground text-sm">
                      Nenhum profissional encontrado
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button
              className="gradient-primary"
              disabled={!selectedProfessional || isInviting}
              onClick={handleInvite}
            >
              {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Convite
            </Button>
          </div>
        </div>

        <div className="text-center text-muted-foreground text-sm">OU</div>

        <p className="text-muted-foreground text-sm">
          Compartilhe o link de convite diretamente com outra profissional.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isLinkPending}
            onClick={handleCopyLink}
          >
            {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {isCopied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={isLinkPending}
            onClick={handleShareWhatsApp}
          >
            <CustomIcon icon="whatsapp" className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
