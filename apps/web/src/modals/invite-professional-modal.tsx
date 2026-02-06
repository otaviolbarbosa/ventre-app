import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { Professional, ProfessionalType } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { supabase } from "@nascere/supabase";
import { Label } from "@radix-ui/react-label";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type InviteProfessionalModal = {
  patientId: string;
  isOpen: boolean;
  availableTypes: ProfessionalType[];
  setIsOpen: (open: boolean) => void;
  onClose?: VoidFunction;
};

export default function InviteProfessionalModal({
  patientId,
  isOpen,
  availableTypes,
  setIsOpen,
  onClose,
}: InviteProfessionalModal) {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isInviteSent, setIsInviteSent] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const { user } = useAuth();

  const handleCloseModal = () => {
    setIsOpen(false);
    setSelectedProfessional("");
    setSelectedType("");
    setSearchEmail("");
    setIsInviteSent(false);
    setIsCopied(false);

    onClose?.();
  };

  function handleShareWhatsApp() {
    const url = getInviteUrl();
    const selectedProf = professionals.find((p) => p.id === selectedProfessional);
    const message = `Olá${selectedProf ? ` ${selectedProf.name.split(" ")[0]}` : ""}! Você foi convidado(a) para participar de uma equipe de cuidado no Nascere. Acesse o link para ver o convite: ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  }

  function getInviteUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invites`;
  }

  function handleCopyLink() {
    const url = getInviteUrl();
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setIsCopied(false), 2000);
  }

  async function searchProfessionals() {
    if (!searchEmail || searchEmail.length < 3) return;

    let query = supabase
      .from("users")
      .select("id, name, email, professional_type")
      .eq("user_type", "professional")
      .ilike("email", `%${searchEmail}%`)
      .limit(5);

    if (user?.id) {
      query = query.neq("id", user.id);
    }

    const { data } = await query;

    setProfessionals(data || []);
  }

  async function handleInvite() {
    if (!selectedProfessional || !selectedType) {
      toast.error("Selecione um profissional e tipo");
      return;
    }

    setIsInviting(true);

    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          invited_professional_id: selectedProfessional,
          professional_type: selectedType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao enviar convite");
      }

      toast.success("Convite enviado com sucesso!");
      setIsInviteSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <ContentModal
      open={isOpen}
      onOpenChange={handleCloseModal}
      title={isInviteSent ? "Convite Enviado!" : "Convidar Profissional"}
      description={
        isInviteSent
          ? "Você também pode compartilhar o link com o profissional para que ele possa aceitar o convite."
          : "Busque um profissional pelo email para convidar para a equipe."
      }
    >
      {isInviteSent ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
              {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {isCopied ? "Copiado!" : "Copiar Link"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleShareWhatsApp}>
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar por email</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@exemplo.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
              <Button type="button" className="gradient-primary" onClick={searchProfessionals}>
                Buscar
              </Button>
            </div>
          </div>

          {professionals.length > 0 && (
            <div className="space-y-2">
              <Label>Selecione o profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo de profissional</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {professionalTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              className="gradient-primary"
              disabled={isInviting || !selectedProfessional || !selectedType}
              onClick={handleInvite}
            >
              Enviar Convite
            </Button>
          </div>
        </div>
      )}
    </ContentModal>
  );
}
