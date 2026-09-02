"use client";

import {
  createPaymentLinkAction,
  deletePaymentLinkAction,
  getPaymentLinksByPlanAction,
  updatePaymentLinkAction,
} from "@/actions/stripe-payment-links";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Checkbox } from "@ventre/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ventre/ui/dialog";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ventre/ui/table";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Local type mirroring the `stripe_payment_link` table (see Task 2's migration:
// packages/supabase/supabase/migrations/20260901000001_stripe_payment_link_table.sql).
// Replace with `Tables<"stripe_payment_link">` from "@ventre/supabase/types" once
// `pnpm db:types` has been run against a linked Supabase project and the generated
// database.types.ts includes this table.
type PaymentLink = {
  id: string;
  plan_id: string;
  frequence: "month" | "quarter" | "semester" | "year";
  payment_link_url: string;
  stripe_payment_link_id: string;
  is_active: boolean;
  is_primary: boolean;
  is_priority: boolean;
  is_limited: boolean;
  total_subscriptions: number | null;
  used_subscription: number;
  amount: number | null;
  created_at: string;
  updated_at: string;
};

const frequenceLabels: Record<string, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

type FormState = {
  frequence: "month" | "quarter" | "semester" | "year";
  payment_link_url: string;
  stripe_payment_link_id: string;
  is_active: boolean;
  is_primary: boolean;
  is_priority: boolean;
  is_limited: boolean;
  total_subscriptions: string;
  amount: string;
};

const emptyForm: FormState = {
  frequence: "month",
  payment_link_url: "",
  stripe_payment_link_id: "",
  is_active: true,
  is_primary: false,
  is_priority: false,
  is_limited: false,
  total_subscriptions: "",
  amount: "",
};

// next-safe-action's default validation errors shape (no custom
// handleValidationErrorsShape is configured in apps/admin/src/lib/safe-action.ts) is the
// zod-`.format()`-style tree: `{ _errors: string[], <field>: { _errors: string[] }, ... }`.
// Task 12's schema attaches its two business-rule refinements to specific fields
// (`path: ["amount"]`, `path: ["total_subscriptions"]`) rather than the schema root, so the
// message can live either at the root `_errors` or under a field key — walk both to find the
// first message present.
function firstValidationErrorMessage(validationErrors: unknown): string | undefined {
  if (!validationErrors || typeof validationErrors !== "object") return undefined;

  const rootErrors = (validationErrors as { _errors?: string[] })._errors;
  if (rootErrors && rootErrors.length > 0) return rootErrors[0];

  for (const [key, value] of Object.entries(validationErrors)) {
    if (key === "_errors" || !value || typeof value !== "object") continue;
    const fieldErrors = (value as { _errors?: string[] })._errors;
    if (fieldErrors && fieldErrors.length > 0) return fieldErrors[0];
  }

  return undefined;
}

export function PlanPaymentLinksSection({ planId }: { planId: string }) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { execute: loadLinks } = useAction(getPaymentLinksByPlanAction, {
    onSuccess: ({ data }) => setLinks((data ?? []) as PaymentLink[]),
    onError: ({ error }) =>
      toast.error(
        firstValidationErrorMessage(error.validationErrors) ??
          error.serverError ??
          "Erro ao carregar links de pagamento",
      ),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadLinks identity changes every render; only planId should retrigger the fetch
  useEffect(() => {
    loadLinks({ plan_id: planId });
  }, [planId]);

  const { execute: createLink, isExecuting: isCreating } = useAction(createPaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento criado!");
      setIsDialogOpen(false);
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) =>
      toast.error(
        firstValidationErrorMessage(error.validationErrors) ??
          error.serverError ??
          "Erro ao criar link de pagamento",
      ),
  });

  const { execute: updateLink, isExecuting: isUpdating } = useAction(updatePaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento atualizado!");
      setIsDialogOpen(false);
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) =>
      toast.error(
        firstValidationErrorMessage(error.validationErrors) ??
          error.serverError ??
          "Erro ao atualizar link de pagamento",
      ),
  });

  const { execute: deleteLink } = useAction(deletePaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento excluído!");
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) =>
      toast.error(
        firstValidationErrorMessage(error.validationErrors) ??
          error.serverError ??
          "Erro ao excluir link de pagamento",
      ),
  });

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function openEditDialog(link: PaymentLink) {
    setEditingId(link.id);
    setForm({
      frequence: link.frequence,
      payment_link_url: link.payment_link_url,
      stripe_payment_link_id: link.stripe_payment_link_id,
      is_active: link.is_active,
      is_primary: link.is_primary,
      is_priority: link.is_priority,
      is_limited: link.is_limited,
      total_subscriptions: link.total_subscriptions != null ? String(link.total_subscriptions) : "",
      amount: link.amount != null ? String(link.amount) : "",
    });
    setIsDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      plan_id: planId,
      frequence: form.frequence,
      payment_link_url: form.payment_link_url,
      stripe_payment_link_id: form.stripe_payment_link_id,
      is_active: form.is_active,
      is_primary: form.is_primary,
      is_priority: form.is_priority,
      is_limited: form.is_limited,
      total_subscriptions: form.total_subscriptions !== "" ? Number(form.total_subscriptions) : null,
      amount: form.amount !== "" ? Number(form.amount) : null,
    };

    if (editingId) {
      updateLink({ id: editingId, ...payload });
    } else {
      createLink(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir este link de pagamento?")) return;
    deleteLink({ id });
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Links de pagamento</h2>
          <Button type="button" onClick={openCreateDialog}>
            Novo link
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Frequência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Stripe ID</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell>{frequenceLabels[link.frequence] ?? link.frequence}</TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={link.is_active ? "default" : "outline"}>
                    {link.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  {link.is_primary && <Badge variant="outline">Primário</Badge>}
                  {link.is_priority && <Badge variant="outline">Prioridade</Badge>}
                </TableCell>
                <TableCell>
                  {link.amount != null
                    ? (link.amount / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </TableCell>
                <TableCell>
                  {link.is_limited ? `${link.used_subscription}/${link.total_subscriptions}` : "Ilimitado"}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground text-xs">
                  {link.stripe_payment_link_id}
                </TableCell>
                <TableCell className="space-x-3 text-right">
                  <button
                    type="button"
                    className="text-primary text-sm hover:underline"
                    onClick={() => openEditDialog(link)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-destructive text-sm hover:underline"
                    onClick={() => handleDelete(link.id)}
                  >
                    Excluir
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum link de pagamento cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar link de pagamento" : "Novo link de pagamento"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Frequência *</Label>
              <Select
                value={form.frequence}
                onValueChange={(v) => setForm((f) => ({ ...f, frequence: v as FormState["frequence"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="quarter">Trimestral</SelectItem>
                  <SelectItem value="semester">Semestral</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>URL do payment link *</Label>
              <Input
                value={form.payment_link_url}
                onChange={(e) => setForm((f) => ({ ...f, payment_link_url: e.target.value }))}
                placeholder="https://buy.stripe.com/..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>ID do payment link no Stripe *</Label>
              <Input
                value={form.stripe_payment_link_id}
                onChange={(e) => setForm((f) => ({ ...f, stripe_payment_link_id: e.target.value }))}
                placeholder="plink_..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Valor promocional em centavos (obrigatório para anual)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="9000"
              />
            </div>

            <div className="space-y-1">
              <Label>Total de assinaturas (se limitado)</Label>
              <Input
                type="number"
                min={1}
                value={form.total_subscriptions}
                onChange={(e) => setForm((f) => ({ ...f, total_subscriptions: e.target.value }))}
                placeholder="20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-active"
                  checked={form.is_active}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
                />
                <Label htmlFor="pl-active">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-primary"
                  checked={form.is_primary}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_primary: c === true }))}
                />
                <Label htmlFor="pl-primary">Primário</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-priority"
                  checked={form.is_priority}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_priority: c === true }))}
                />
                <Label htmlFor="pl-priority">Prioridade</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-limited"
                  checked={form.is_limited}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_limited: c === true }))}
                />
                <Label htmlFor="pl-limited">Uso limitado</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
