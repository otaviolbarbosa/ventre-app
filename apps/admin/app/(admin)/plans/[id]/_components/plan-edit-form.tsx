"use client";

import { deletePlanAction, updatePlanAction } from "@/actions/plans";
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

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  value: number | null;
  benefits: string[];
};

export function PlanEditForm({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [slug, setSlug] = useState(plan.slug);
  const [description, setDescription] = useState(plan.description ?? "");
  const [type, setType] = useState(plan.type);
  const [value, setValue] = useState<string>(plan.value != null ? String(plan.value) : "");
  const [benefitsText, setBenefitsText] = useState(plan.benefits.join("\n"));

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updatePlanAction, {
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso!");
      router.push("/plans");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar plano");
    },
  });

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(deletePlanAction, {
    onSuccess: () => {
      toast.success("Plano excluído com sucesso!");
      router.push("/plans");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir plano");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const benefits = benefitsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);

    executeUpdate({
      id: plan.id,
      name,
      slug,
      description: description || null,
      type: type as "free" | "premium" | "enterprise",
      value: value !== "" ? Number(value) : null,
      benefits,
    });
  }

  function handleDelete() {
    if (
      !window.confirm("Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.")
    )
      return;
    executeDelete({ id: plan.id });
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

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="destructive-outline"
                onClick={handleDelete}
                disabled={isDeleting || isUpdating}
              >
                {isDeleting ? "Excluindo..." : "Excluir plano"}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <a href="/plans">Cancelar</a>
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
