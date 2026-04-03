"use client";

import { deletePlanAction, getPaginatedPlansAction } from "@/actions/plans";
import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { DataTable } from "@ventre/ui/shared/data-table";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type Plan = Tables<"plans">;

const planTypeLabels: Record<string, string> = {
  free: "Gratuito",
  premium: "Premium",
  enterprise: "Empresarial",
};

export function PlansTable() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const lastFetchRef = useRef<{ page: number; size: number }>({ page: 1, size: 10 });

  const { execute: loadPlans } = useAction(getPaginatedPlansAction, {
    onSuccess: ({ data }) => {
      setPlans(data.data);
      setTotalPages(data.pagination.total_pages);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar planos");
    },
  });

  const { execute: deletePlan } = useAction(deletePlanAction, {
    onSuccess: () => {
      toast.success("Plano excluído com sucesso!");
      loadPlans(lastFetchRef.current);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir plano");
    },
  });

  const fetchData = useCallback(
    (page: number, size: number) => {
      lastFetchRef.current = { page, size };
      loadPlans({ page, size });
    },
    [loadPlans],
  );

  return (
    <DataTable
      data={plans}
      totalPages={totalPages}
      fetchData={fetchData}
      onDeleteAction={(id) => deletePlan({ id })}
      options={{
        modelName: "Plano",
        path: "plans",
        fieldsToSearch: ["name", "slug"],
        columns: [
          { label: "Nome", name: "name" },
          {
            label: "Slug",
            name: "slug",
            callback: (plan) => (
              <span className="font-mono text-muted-foreground text-xs">{plan.slug}</span>
            ),
          },
          {
            label: "Tipo",
            name: "type",
            callback: (plan) => (
              <Badge variant="default">{planTypeLabels[plan.type] ?? plan.type}</Badge>
            ),
          },
          {
            label: "Valor",
            name: "value",
            callback: (plan) => (
              <span className="text-muted-foreground">{formatCurrency(plan.value)}</span>
            ),
          },
          {
            label: "Benefícios",
            name: "benefits",
            callback: (plan) => (
              <span className="text-muted-foreground">{plan.benefits?.length ?? 0} item(s)</span>
            ),
          },
        ],
        actions: [
          (plan) => (
            <Link href={`/plans/${plan.id}`} className="text-primary text-sm hover:underline">
              Editar
            </Link>
          ),
          "delete",
        ],
      }}
    />
  );
}
