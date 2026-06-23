"use client";

import { saveInstallmentLinkAction } from "@/actions/save-installment-link-action";
import {
  type AppliedBillingFee,
  computeNetAmountCents,
  formatCurrency,
} from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Check, CheckCircle, ExternalLink, FileText, Image, LinkIcon, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";

type Payment = Tables<"payments"> & { receipt_url?: string | null };
type Installment = Tables<"installments"> & { payments: Payment[] };

type InstallmentListProps = {
  billingId: string;
  installments: Installment[];
  onRecordPayment: (installment: Installment) => void;
  onUpdate: () => void;
  professionals?: Record<string, string>;
  appliedBillingFees?: AppliedBillingFee[];
  professionalId?: string;
};

export function InstallmentList({
  billingId,
  installments,
  onRecordPayment,
  onUpdate,
  professionals,
  appliedBillingFees = [],
  professionalId,
}: InstallmentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");

  const { executeAsync: saveLink, isPending: saving } = useAction(saveInstallmentLinkAction);

  const handleEditLink = (installment: Installment) => {
    setEditingId(installment.id);
    setLinkValue(installment.payment_link || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLinkValue("");
  };

  const handleSaveLink = async (installmentId: string) => {
    const result = await saveLink({
      billingId,
      installmentId,
      paymentLink: linkValue.trim(),
    });

    if (result?.serverError) {
      toast.error("Erro ao salvar link de pagamento");
      return;
    }

    toast.success("Link de pagamento salvo!");
    setEditingId(null);
    setLinkValue("");
    onUpdate();
  };

  return (
    <div className="space-y-3">
      {installments
        .sort((a, b) => a.installment_number - b.installment_number)
        .map((installment) => {
          const splitted = installment.splitted_installment as Record<string, number> | null;
          const professionalGrossAmountCents =
            !professionals && professionalId && splitted
              ? (splitted[professionalId] ?? undefined)
              : undefined;
          const { netAmountCents, totalFeesCents } =
            professionalGrossAmountCents !== undefined && professionalId
              ? computeNetAmountCents(
                  professionalGrossAmountCents,
                  appliedBillingFees,
                  professionalId,
                )
              : { netAmountCents: installment.amount, totalFeesCents: 0 };
          const paidRatio =
            installment.amount > 0 ? installment.paid_amount / installment.amount : 0;
          const displayPaidAmount =
            professionalGrossAmountCents !== undefined
              ? Math.round(professionalGrossAmountCents * paidRatio)
              : installment.paid_amount;

          return (
            <div
              key={installment.id}
              className="flex flex-col gap-3 rounded-lg border bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-sm">
                    {installment.installment_number}
                  </div>
                  <div className="w-full space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="font-medium">{formatCurrency(netAmountCents)}</span>
                        {totalFeesCents > 0 && (
                          <span className="whitespace-nowrap text-muted-foreground text-xs">
                            (−{formatCurrency(totalFeesCents)} taxas)
                          </span>
                        )}
                      </div>
                      <StatusBadge status={installment.status} />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {installment.status !== "pago" && (
                        <>Vencimento: {dayjs(installment.due_date).format("DD/MM/YYYY")}</>
                      )}
                      {displayPaidAmount > 0 && (
                        <>Pago em: {dayjs(installment.paid_at).format("DD/MM/YYYY")}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {installment.status === "pago" &&
                    installment.payments
                      .filter((p) => p.receipt_url)
                      .map((p) => (
                        <Button key={p.id} variant="ghost" size="sm" asChild>
                          <a
                            href={p.receipt_url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {p.receipt_path?.endsWith(".pdf") ? (
                              <FileText className="mr-1 h-4 w-4 text-red-500" />
                            ) : (
                              <Image className="mr-1 h-4 w-4 text-blue-500" />
                            )}
                            Comprovante
                          </a>
                        </Button>
                      ))}
                  {installment.status !== "pago" && installment.status !== "cancelado" && (
                    <div className="flex w-full justify-between">
                      {installment.payment_link && editingId !== installment.id && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={installment.payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Link
                          </a>
                        </Button>
                      )}
                      {!installment.payment_link ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditLink(installment)}
                        >
                          <LinkIcon className="mr-1 h-4 w-4" />
                          Adicionar link
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRecordPayment(installment)}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Registrar Pagamento
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {professionals && installment.splitted_installment && (
                <div className="space-y-0.5 border-t pt-2">
                  {Object.entries(installment.splitted_installment as Record<string, number>).map(
                    ([profId, amount]) => (
                      <ProfessionalNetAmount
                        key={profId}
                        professionalId={profId}
                        professionalName={professionals[profId] ?? profId}
                        grossAmountCents={amount}
                        appliedFees={appliedBillingFees}
                      />
                    ),
                  )}
                </div>
              )}
              {editingId === installment.id && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://..."
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveLink(installment.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => handleSaveLink(installment.id)}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={saving} onClick={handleCancelEdit}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
