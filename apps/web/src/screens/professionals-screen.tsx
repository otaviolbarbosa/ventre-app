"use client";

import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import NewPatientModal from "@/modals/new-patient-modal";
import type { EnterpriseProfessional } from "@/services/professional";
import { Copy, Plus, Stethoscope, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type ProfessionalsScreenProps = {
  professionals: EnterpriseProfessional[];
  enterpriseToken: string | null;
};

export default function ProfessionalsScreen({
  professionals,
  enterpriseToken,
}: ProfessionalsScreenProps) {
  const router = useRouter();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<EnterpriseProfessional | null>(
    null,
  );

  function handleAddPatient(professional: EnterpriseProfessional) {
    setSelectedProfessional(professional);
    setShowNewPatientModal(true);
  }

  function handleCopyToken() {
    if (!enterpriseToken) return;
    navigator.clipboard.writeText(enterpriseToken);
    toast.success("Token copiado!");
  }

  return (
    <div>
      <Header title="Profissionais" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              className="gradient-primary flex sm:hidden"
              onClick={() => setShowTokenModal(true)}
            >
              <UserPlus className="size-4" />
            </Button>
            <Button
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowTokenModal(true)}
            >
              <UserPlus className="size-4" />
              Adicionar Profissional
            </Button>
          </div>
        </PageHeader>

        {professionals.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum profissional cadastrado"
            description="Compartilhe o token da organização para que profissionais possam ingressar."
          >
            <Button onClick={() => setShowTokenModal(true)}>
              <UserPlus className="mr-2 size-4" />
              Ver Token de Convite
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.map((professional) => (
              <Card key={professional.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {getInitials(professional.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{professional.name ?? "—"}</p>
                      {professional.professional_type && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {PROFESSIONAL_TYPE_LABELS[professional.professional_type] ??
                            professional.professional_type}
                        </Badge>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-muted-foreground text-sm">
                        <Stethoscope className="size-3.5" />
                        <span>
                          {professional.patient_count}{" "}
                          {professional.patient_count === 1 ? "gestante" : "gestantes"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleAddPatient(professional)}
                  >
                    <Plus className="size-3.5" />
                    Adicionar Gestante
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Token modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Profissional</DialogTitle>
            <DialogDescription>
              Compartilhe o token abaixo com o profissional. Ele deve inserir este código ao
              ingressar na plataforma para entrar na sua organização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={enterpriseToken ?? "—"}
                className="text-center font-mono text-lg tracking-widest"
              />
              <Button size="icon" variant="outline" onClick={handleCopyToken}>
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              O profissional deve acessar a plataforma, criar uma conta e inserir este token na
              etapa de configuração da organização.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <NewPatientModal
        showModal={showNewPatientModal}
        setShowModal={setShowNewPatientModal}
        professionals={selectedProfessional ? [selectedProfessional] : undefined}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
