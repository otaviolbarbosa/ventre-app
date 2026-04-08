"use client";

import { deleteUserAction, updateUserAction } from "@/actions/users";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type User = {
  id: string;
  name: string;
  email: string;
  user_type: string;
  professional_type: string | null;
  enterprise_id: string | null;
};

type Enterprise = {
  id: string;
  name: string;
};

export function UserEditForm({ user, enterprises }: { user: User; enterprises: Enterprise[] }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [userType, setUserType] = useState(user.user_type);
  const [professionalType, setProfessionalType] = useState(user.professional_type ?? "");
  const [enterpriseId, setEnterpriseId] = useState(user.enterprise_id ?? "");

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updateUserAction, {
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      router.push("/users");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar usuário");
    },
  });

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(deleteUserAction, {
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      router.push("/users");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir usuário");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeUpdate({
      id: user.id,
      name,
      email,
      user_type: userType as "professional" | "patient" | "manager" | "secretary" | "admin",
      professional_type: professionalType
        ? (professionalType as "obstetra" | "enfermeiro" | "doula")
        : null,
      enterprise_id: enterpriseId || null,
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.",
      )
    )
      return;
    executeDelete({ id: user.id });
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo de usuário</Label>
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="patient">Paciente</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="secretary">Secretária</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Especialidade</Label>
              <Select value={professionalType} onValueChange={setProfessionalType}>
                <SelectTrigger>
                  <SelectValue placeholder="— Nenhuma —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Nenhuma —</SelectItem>
                  <SelectItem value="obstetra">Obstetra</SelectItem>
                  <SelectItem value="enfermeiro">Enfermeiro(a)</SelectItem>
                  <SelectItem value="doula">Doula</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Empresa</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Nenhuma —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Nenhuma —</SelectItem>
                  {enterprises.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="destructive-outline"
                onClick={handleDelete}
                disabled={isDeleting || isUpdating}
              >
                {isDeleting ? "Excluindo..." : "Excluir usuário"}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <a href="/users">Cancelar</a>
                </Button>
                <Button type="submit" disabled={isUpdating || isDeleting}>
                  {isUpdating ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
