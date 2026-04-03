"use client";

import { deleteSubscriptionAction, getPaginatedSubscriptionsAction } from "@/actions/subscriptions";
import { formatDate } from "@/lib/utils";
import type { SubscriptionRow } from "@/types";
import type { BadgeProps } from "@ventre/ui/badge";
import { Badge } from "@ventre/ui/badge";
import { DataTable } from "@ventre/ui/shared/data-table";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  active: "Ativa",
  pending: "Pendente",
  canceling: "Cancelando",
  canceled: "Cancelada",
  expired: "Expirada",
  failed: "Falhou",
  replaced: "Substituída",
};

const statusVariants: Record<string, BadgeProps["variant"]> = {
  active: "success",
  pending: "warning",
  canceling: "warning",
  canceled: "destructive",
  expired: "info",
  failed: "destructive",
  replaced: "secondary",
};

const frequenceLabels: Record<string, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

export function SubscriptionsTable() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const lastFetchRef = useRef<{ page: number; size: number }>({ page: 1, size: 10 });

  const { execute: loadSubscriptions } = useAction(getPaginatedSubscriptionsAction, {
    onSuccess: ({ data }) => {
      setSubscriptions(data.data);
      setTotalPages(data.pagination.total_pages);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar assinaturas");
    },
  });

  const { execute: deleteSubscription } = useAction(deleteSubscriptionAction, {
    onSuccess: () => {
      toast.success("Assinatura excluída com sucesso!");
      loadSubscriptions(lastFetchRef.current);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir assinatura");
    },
  });

  const fetchData = useCallback(
    (page: number, size: number) => {
      lastFetchRef.current = { page, size };
      loadSubscriptions({ page, size });
    },
    [loadSubscriptions],
  );

  return (
    <DataTable
      data={subscriptions}
      totalPages={totalPages}
      fetchData={fetchData}
      onDeleteAction={(id) => deleteSubscription({ id })}
      options={{
        modelName: "Assinatura",
        path: "subscriptions",
        fieldsToSearch: ["user_name", "user_email"],
        columns: [
          {
            label: "Usuário",
            name: "user_name",
            callback: (sub) => (
              <div className="flex flex-col">
                <span className="font-medium">{sub.user_name ?? "—"}</span>
                <span className="text-muted-foreground text-xs">{sub.user_email ?? "—"}</span>
              </div>
            ),
          },
          {
            label: "Plano",
            name: "plan_name",
            callback: (sub) => (
              <span className="text-muted-foreground">{sub.plan_name ?? "—"}</span>
            ),
          },
          {
            label: "Frequência",
            name: "frequence",
            callback: (sub) => (
              <span className="text-muted-foreground">
                {frequenceLabels[sub.frequence] ?? sub.frequence}
              </span>
            ),
          },
          {
            label: "Status",
            name: "status",
            callback: (sub) => (
              <Badge variant={statusVariants[sub.status] ?? "info"}>
                {statusLabels[sub.status] ?? sub.status}
              </Badge>
            ),
          },
          {
            label: "Expira em",
            name: "expires_at",
            callback: (sub) => (
              <span className="text-muted-foreground">{formatDate(sub.expires_at)}</span>
            ),
          },
          {
            label: "Pago em",
            name: "paid_at",
            callback: (sub) => (
              <span className="text-muted-foreground">{formatDate(sub.paid_at)}</span>
            ),
          },
        ],
        actions: [
          (sub) => (
            <Link
              href={`/subscriptions/${sub.id}`}
              className="text-primary text-sm hover:underline"
            >
              Editar
            </Link>
          ),
          "delete",
        ],
      }}
    />
  );
}
