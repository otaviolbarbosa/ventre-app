"use client";

import { deletePatientAction, updatePatientAction } from "@/actions/patients";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Patient = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  date_of_birth: string | null;
  created_at: string | null;
  created_by: string;
};

export function PatientEditForm({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [name, setName] = useState(patient.name);
  const [email, setEmail] = useState(patient.email ?? "");
  const [phone, setPhone] = useState(patient.phone);
  const [dateOfBirth, setDateOfBirth] = useState(patient.date_of_birth?.split("T")[0] ?? "");

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updatePatientAction, {
    onSuccess: () => {
      toast.success("Paciente atualizado com sucesso!");
      router.push("/patients");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar paciente");
    },
  });

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(deletePatientAction, {
    onSuccess: () => {
      toast.success("Paciente excluído com sucesso!");
      router.push("/patients");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir paciente");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeUpdate({
      id: patient.id,
      name,
      email: email || null,
      phone,
      date_of_birth: dateOfBirth || null,
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir este paciente? Todos os dados relacionados serão perdidos.",
      )
    )
      return;
    executeDelete({ id: patient.id });
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="destructive-outline"
                onClick={handleDelete}
                disabled={isDeleting || isUpdating}
              >
                {isDeleting ? "Excluindo..." : "Excluir paciente"}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <a href="/patients">Cancelar</a>
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
