"use client";

import { createUserAction } from "@/actions/users";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Enterprise = { id: string; name: string };

export function UserCreateForm({ enterprises }: { enterprises: Enterprise[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("professional");
  const [professionalType, setProfessionalType] = useState("");
  const [enterpriseId, setEnterpriseId] = useState("");

  const { execute, isExecuting } = useAction(createUserAction, {
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      router.push("/users");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar usuário");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    execute({
      name,
      email,
      password,
      user_type: userType as "professional" | "patient" | "manager" | "secretary" | "admin",
      professional_type: professionalType
        ? (professionalType as "obstetra" | "enfermeiro" | "doula")
        : null,
      enterprise_id: enterpriseId || null,
    });
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
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" asChild>
                <a href="/users">Cancelar</a>
              </Button>
              <Button type="submit" disabled={isExecuting}>
                {isExecuting ? "Criando..." : "Criar usuário"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
