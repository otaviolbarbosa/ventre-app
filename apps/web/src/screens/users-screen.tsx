"use client";

import { addEnterpriseProfessionalAction } from "@/actions/add-enterprise-professional-action";
import { removeEnterpriseProfessionalAction } from "@/actions/remove-enterprise-professional-action";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnterpriseStaffMember } from "@/services/enterprise-users";
import type { EnterpriseProfessional } from "@/services/professional";
import { BriefcaseMedical, Stethoscope, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
};

const STAFF_TYPE_LABELS: Record<string, string> = {
  manager: "Gestor",
  secretary: "Secretária",
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

type UsersScreenProps = {
  professionals: EnterpriseProfessional[];
  staff: EnterpriseStaffMember[];
};

export default function UsersScreen({ professionals, staff }: UsersScreenProps) {
  const router = useRouter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [professionalToRemove, setProfessionalToRemove] = useState<EnterpriseProfessional | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleAddProfessional() {
    if (!emailInput.trim()) return;
    setIsAdding(true);
    try {
      const result = await addEnterpriseProfessionalAction({ email: emailInput.trim() });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(`${result?.data?.name ?? "Profissional"} adicionado com sucesso!`);
      setShowAddModal(false);
      setEmailInput("");
      router.refresh();
    } catch {
      toast.error("Erro ao adicionar profissional.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveProfessional() {
    if (!professionalToRemove) return;
    setIsRemoving(true);
    try {
      const result = await removeEnterpriseProfessionalAction({
        professionalId: professionalToRemove.id,
      });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success(`${professionalToRemove.name ?? "Profissional"} removido da empresa.`);
      setProfessionalToRemove(null);
      router.refresh();
    } catch {
      toast.error("Erro ao remover profissional.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div>
      <Header title="Colaboradores" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              className="gradient-primary flex sm:hidden"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus className="size-4" />
            </Button>
            <Button
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus className="size-4" />
              Adicionar Profissional
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="professionals" className="mt-4">
          <TabsList className="mb-4 w-full max-w-xs">
            <TabsTrigger value="professionals">
              Profissionais
              {professionals.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                  {professionals.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="staff">
              Gestores
              {staff.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                  {staff.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Profissionais */}
          <TabsContent value="professionals">
            {professionals.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="Nenhum profissional cadastrado"
                description="Adicione profissionais já cadastrados na plataforma pelo e-mail."
              >
                <Button onClick={() => setShowAddModal(true)}>
                  <UserPlus className="size-4" />
                  Adicionar Profissional
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
                          <p className="truncate text-muted-foreground text-xs">
                            {professional.email ?? "—"}
                          </p>
                          {professional.professional_type && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {PROFESSIONAL_TYPE_LABELS[professional.professional_type] ??
                                professional.professional_type}
                            </Badge>
                          )}
                          <Link
                            href={`/patients?professional=${professional.id}`}
                            className="mt-2 flex items-center gap-1 text-muted-foreground text-sm hover:text-primary hover:underline"
                          >
                            <Stethoscope className="size-3.5" />
                            <span>
                              {professional.patient_count}{" "}
                              {professional.patient_count === 1 ? "gestante" : "gestantes"}
                            </span>
                          </Link>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setProfessionalToRemove(professional)}
                      >
                        <UserMinus className="size-3.5" />
                        Remover da empresa
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Gestores */}
          <TabsContent value="staff">
            {staff.length === 0 ? (
              <EmptyState
                icon={BriefcaseMedical}
                title="Nenhum gestor cadastrado"
                description="Os gestores e secretárias da empresa aparecerão aqui."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staff.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{member.name ?? "—"}</p>
                          <p className="truncate text-muted-foreground text-xs">
                            {member.email ?? "—"}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {STAFF_TYPE_LABELS[member.user_type] ?? member.user_type}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: Adicionar Profissional */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Profissional</DialogTitle>
            <DialogDescription>
              Informe o e-mail de um profissional já cadastrado na plataforma para associá-lo à sua
              empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-input">E-mail do profissional</Label>
              <Input
                id="email-input"
                type="email"
                placeholder="profissional@exemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProfessional()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={isAdding}>
              Cancelar
            </Button>
            <Button
              className="gradient-primary"
              onClick={handleAddProfessional}
              disabled={!emailInput.trim() || isAdding}
            >
              {isAdding ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Remoção */}
      <Dialog
        open={!!professionalToRemove}
        onOpenChange={(open) => !open && setProfessionalToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover profissional</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-foreground">
                {professionalToRemove?.name ?? "este profissional"}
              </span>{" "}
              da empresa? Ele perderá o acesso às funcionalidades da organização.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProfessionalToRemove(null)}
              disabled={isRemoving}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemoveProfessional} disabled={isRemoving}>
              {isRemoving ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
