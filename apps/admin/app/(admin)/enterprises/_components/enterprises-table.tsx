"use client";

import { deleteEnterpriseAction, getPaginatedEnterprisesAction } from "@/actions/enterprises";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { DataTable } from "@ventre/ui/shared/data-table";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type Enterprise = Tables<"enterprises">;

export function EnterprisesTable() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const lastFetchRef = useRef<{ page: number; size: number }>({ page: 1, size: 10 });

  const { execute: loadEnterprises } = useAction(getPaginatedEnterprisesAction, {
    onSuccess: ({ data }) => {
      setEnterprises(data.data);
      setTotalPages(data.pagination.total_pages);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar empresas");
    },
  });

  const { execute: deleteEnterprise } = useAction(deleteEnterpriseAction, {
    onSuccess: () => {
      toast.success("Empresa excluída com sucesso!");
      loadEnterprises(lastFetchRef.current);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir empresa");
    },
  });

  const fetchData = useCallback(
    (page: number, size: number) => {
      lastFetchRef.current = { page, size };
      loadEnterprises({ page, size });
    },
    [loadEnterprises],
  );

  return (
    <DataTable
      data={enterprises}
      totalPages={totalPages}
      fetchData={fetchData}
      onDeleteAction={(id) => deleteEnterprise({ id })}
      options={{
        modelName: "Empresa",
        path: "enterprises",
        fieldsToSearch: ["name", "email", "cnpj"],
        columns: [
          {
            label: "Nome",
            name: "name",
            callback: (ent) => (
              <div className="flex flex-col">
                <span className="font-medium">{ent.name}</span>
                {ent.legal_name && (
                  <span className="text-muted-foreground text-xs">{ent.legal_name}</span>
                )}
              </div>
            ),
          },
          { label: "CNPJ", name: "cnpj" },
          { label: "E-mail", name: "email" },
          {
            label: "Profissionais",
            name: "professionals_amount",
          },
          {
            label: "Status",
            name: "is_active",
            callback: (ent) => (
              <Badge variant={ent.is_active ? "success" : "destructive"}>
                {ent.is_active ? "Ativa" : "Inativa"}
              </Badge>
            ),
          },
          {
            label: "Criada em",
            name: "created_at",
            callback: (ent) => formatDate(ent.created_at),
          },
        ],
        actions: [
          (ent) => (
            <Link href={`/enterprises/${ent.id}`} className="text-primary text-sm hover:underline">
              Editar
            </Link>
          ),
          "delete",
        ],
      }}
    />
  );
}
