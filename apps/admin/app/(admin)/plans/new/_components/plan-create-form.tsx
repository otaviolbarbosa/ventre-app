"use client";

import { createPlanAction } from "@/actions/plans";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Textarea } from "@ventre/ui/textarea";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function PlanCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("premium");
  const [value, setValue] = useState("");
  const [benefitsText, setBenefitsText] = useState("");

  const { execute, isExecuting } = useAction(createPlanAction, {
    onSuccess: () => {
      toast.success("Plano criado com sucesso!");
      router.push("/plans");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar plano");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const benefits = benefitsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);

    execute({
      name,
      slug,
      description: description || null,
      type: type as "free" | "premium" | "enterprise",
      value: value !== "" ? Number(value) : null,
      benefits,
    });
  }

  // Auto-generate slug from name
  function handleNameChange(val: string) {
    setName(val);
    if (!slug) {
      setSlug(
        val
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>Slug *</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Empresarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Benefícios (um por linha)</Label>
              <Textarea
                value={benefitsText}
                onChange={(e) => setBenefitsText(e.target.value)}
                rows={6}
                className="resize-none font-mono text-xs"
                placeholder={"Benefício 1\nBenefício 2\nBenefício 3"}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" asChild>
                <a href="/plans">Cancelar</a>
              </Button>
              <Button type="submit" disabled={isExecuting}>
                {isExecuting ? "Criando..." : "Criar plano"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
