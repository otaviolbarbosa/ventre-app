"use client";

import { createEnterpriseAction } from "@/actions/enterprises";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function EnterpriseCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [professionalsAmount, setProfessionalsAmount] = useState(1);
  const [slug, setSlug] = useState("");

  const { execute, isExecuting } = useAction(createEnterpriseAction, {
    onSuccess: () => {
      toast.success("Empresa criada com sucesso!");
      router.push("/enterprises");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar empresa");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    execute({
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
                <Label>Slug *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="nome-empresa"
                />
              </div>

              <div className="space-y-1">
                <Label>Qtd. Profissionais *</Label>
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

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <a href="/enterprises">Cancelar</a>
              </Button>
              <Button type="submit" disabled={isExecuting}>
                {isExecuting ? "Criando..." : "Criar empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
