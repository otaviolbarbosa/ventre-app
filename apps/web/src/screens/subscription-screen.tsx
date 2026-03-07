"use client";

import { cancelSubscriptionAction } from "@/actions/cancel-subscription-action";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Tables } from "@nascere/supabase/types";
import { Building2, Calendar, CheckCircle2, CreditCard, RefreshCw, User } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Plan = Tables<"plans">;
type Subscription = Tables<"subscriptions"> & { plans: Plan | null };
type Profile = Tables<"users">;

type SubscriptionScreenProps = {
  subscription: Subscription | null;
  profile: Profile;
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativa", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  canceling: { label: "Cancelamento solicitado", variant: "outline" },
  canceled: { label: "Cancelada", variant: "destructive" },
  expired: { label: "Expirada", variant: "destructive" },
  failed: { label: "Falha no pagamento", variant: "destructive" },
  replaced: { label: "Substituída", variant: "secondary" },
};

const FREQUENCE_MAP: Record<string, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

const PLAN_TYPE_MAP: Record<string, string> = {
  free: "Gratuito",
  premium: "Premium",
  enterprise: "Empresarial",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "Sob consulta";
  if (value === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function SubscriptionScreen({ subscription, profile }: SubscriptionScreenProps) {
  const isEnterprise = !!profile.enterprise_id;
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { execute: cancelSubscription, status: cancelStatus } = useAction(
    cancelSubscriptionAction,
    {
      onSuccess: () => {
        toast.success("Cancelamento solicitado. Seu acesso permanece ativo até o fim do período.");
        setConfirmCancel(false);
        router.refresh();
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Erro ao cancelar assinatura.");
        setConfirmCancel(false);
      },
    },
  );

  const isCanceling = cancelStatus === "executing";
  const canCancel = !isEnterprise && subscription?.status === "active";

  if (!subscription) {
    return (
      <div className="flex flex-col items-center px-4 py-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <CreditCard className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="font-semibold text-lg">Nenhuma assinatura encontrada</h2>
        <p className="mt-2 text-center text-muted-foreground text-sm">
          Você ainda não possui uma assinatura ativa.
        </p>
      </div>
    );
  }

  const plan = subscription.plans;
  const status = STATUS_MAP[subscription.status] ?? {
    label: subscription.status,
    variant: "secondary" as const,
  };
  const frequence = FREQUENCE_MAP[subscription.frequence] ?? subscription.frequence;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {/* Plano */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{plan?.name ?? "Plano"}</CardTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          {plan?.type && (
            <p className="text-muted-foreground text-sm">{PLAN_TYPE_MAP[plan.type] ?? plan.type}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Valor</span>
            <span className="font-semibold">{formatCurrency(plan?.value ?? null)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Cobrança</span>
            <span className="text-sm">{frequence}</span>
          </div>
        </CardContent>
      </Card>

      {/* Datas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-muted-foreground text-sm">Pagamento</span>
              <span className="text-sm">{formatDate(subscription.paid_at)}</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-muted-foreground text-sm">Validade</span>
              <span className="text-sm">{formatDate(subscription.expires_at)}</span>
            </div>
          </div>
          <Separator />
          <p className="text-muted-foreground text-xs">
            A renovação é feita automaticamente ao fim de cada período.
          </p>
        </CardContent>
      </Card>

      {/* Titular */}
      {profile.enterprise_id ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Titular</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {isEnterprise ? (
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm">
              {isEnterprise ? "Empresa" : (profile.name ?? profile.email)}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* Benefícios */}
      {plan?.benefits && plan.benefits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Benefícios incluídos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {plan.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Motivo de cancelamento */}
      {subscription.cancelation_reason && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Motivo do cancelamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{subscription.cancelation_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Cancelar assinatura */}
      {canCancel && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Cancelar assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Ao cancelar sua assinatura, ela permanecerá ativa até o fim do período já pago. Após
              essa data, você perderá o acesso aos recursos premium e não será cobrado novamente.
            </p>
            <Button variant="destructive-outline" onClick={() => setConfirmCancel(true)}>
              Cancelar assinatura
            </Button>

            <ConfirmModal
              open={confirmCancel}
              onOpenChange={setConfirmCancel}
              title="Cancelar assinatura"
              description={`Tem certeza? Seu acesso ao conteúdo Mais Cuidado não será renovado após ${formatDate(subscription.expires_at)}.`}
              confirmLabel="Cancelar assinatura"
              cancelLabel="Manter assinatura"
              variant="destructive-inverted"
              loading={isCanceling}
              onConfirm={() => cancelSubscription({ subscriptionId: subscription.id })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
