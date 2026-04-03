"use client";

import { deleteEnterpriseAction, updateEnterpriseAction } from "@/actions/enterprises";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Enterprise = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  professionals_amount: number;
  slug: string;
};

export function EnterpriseEditForm({ enterprise }: { enterprise: Enterprise }) {
  const router = useRouter();
  const [name, setName] = useState(enterprise.name);
  const [legalName, setLegalName] = useState(enterprise.legal_name ?? "");
  const [cnpj, setCnpj] = useState(enterprise.cnpj ?? "");
  const [email, setEmail] = useState(enterprise.email ?? "");
  const [phone, setPhone] = useState(enterprise.phone ?? "");
  const [isActive, setIsActive] = useState(enterprise.is_active);
  const [professionalsAmount, setProfessionalsAmount] = useState(enterprise.professionals_amount);
  const [slug, setSlug] = useState(enterprise.slug);

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updateEnterpriseAction, {
    onSuccess: () => {
      toast.success("Empresa atualizada com sucesso!");
      router.push("/enterprises");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar empresa");
    },
  });

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(deleteEnterpriseAction, {
    onSuccess: () => {
      toast.success("Empresa excluída com sucesso!");
      router.push("/enterprises");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir empresa");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeUpdate({
      id: enterprise.id,
      name,
      legal_name: legalName || null,
      cnpj: cnpj || null,
      email: email || null,
      phone: phone || null,
      is_active: isActive,
      professionals_amount: professionalsAmount,
      slug,
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.",
      )
    )
      return;
    executeDelete({ id: enterprise.id });
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="col-span-2 space-y-1">
                <Label>Razão Social</Label>
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>CNPJ</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="col-span-2 space-y-1">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label>Qtd. Profissionais</Label>
                <Input
                  type="number"
                  min={1}
                  value={professionalsAmount}
                  onChange={(e) => setProfessionalsAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <Checkbox
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(!!checked)}
                />
                <Label htmlFor="is_active">Empresa ativa</Label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                type="button"
                variant="destructive-outline"
                onClick={handleDelete}
                disabled={isDeleting || isUpdating}
              >
                {isDeleting ? "Excluindo..." : "Excluir empresa"}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <a href="/enterprises">Cancelar</a>
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
