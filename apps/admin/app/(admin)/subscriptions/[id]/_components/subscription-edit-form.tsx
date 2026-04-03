"use client";

import { deleteSubscriptionAction, updateSubscriptionAction } from "@/actions/subscriptions";
import { formatDate } from "@/lib/utils";
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

type Subscription = {
  id: string;
  status: string;
  frequence: string;
  expires_at: string | null;
  paid_at: string | null;
  cancelation_reason: string | null;
  created_at: string;
  user_id: string | null;
  enterprise_id: string | null;
  plan_id: string;
  plans: { id: string; name: string } | null;
  users: { id: string; name: string; email: string } | null;
};

export function SubscriptionEditForm({ subscription }: { subscription: Subscription }) {
  const router = useRouter();
  const [status, setStatus] = useState(subscription.status);
  const [expiresAt, setExpiresAt] = useState(subscription.expires_at?.split("T")[0] ?? "");
  const [paidAt, setPaidAt] = useState(subscription.paid_at?.split("T")[0] ?? "");
  const [cancelationReason, setCancelationReason] = useState(subscription.cancelation_reason ?? "");

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updateSubscriptionAction, {
    onSuccess: () => {
      toast.success("Assinatura atualizada com sucesso!");
      router.push("/subscriptions");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar assinatura");
    },
  });

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(deleteSubscriptionAction, {
    onSuccess: () => {
      toast.success("Assinatura excluída com sucesso!");
      router.push("/subscriptions");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir assinatura");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeUpdate({
      id: subscription.id,
      status: status as
        | "active"
        | "pending"
        | "canceling"
        | "canceled"
        | "expired"
        | "failed"
        | "replaced",
      expires_at: expiresAt || null,
      paid_at: paidAt || null,
      cancelation_reason: cancelationReason || null,
    });
  }

  function handleDelete() {
    if (!window.confirm("Tem certeza que deseja excluir esta assinatura?")) return;
    executeDelete({ id: subscription.id });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="pt-6 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Usuário:</span>{" "}
              <span className="font-medium">{subscription.users?.name ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">E-mail:</span>{" "}
              <span>{subscription.users?.email ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Plano:</span>{" "}
              <span className="font-medium">{subscription.plans?.name ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Criada em:</span>{" "}
              <span>{formatDate(subscription.created_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="canceling">Cancelando</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="replaced">Substituída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Expira em</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Pago em</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Motivo do cancelamento</Label>
              <Textarea
                value={cancelationReason}
                onChange={(e) => setCancelationReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="destructive-outline"
                onClick={handleDelete}
                disabled={isDeleting || isUpdating}
              >
                {isDeleting ? "Excluindo..." : "Excluir assinatura"}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <a href="/subscriptions">Cancelar</a>
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
