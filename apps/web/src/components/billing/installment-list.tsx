"use client";

import { confirmInstallmentPaymentAction } from "@/actions/confirm-installment-payment-action";
import { saveInstallmentLinkAction } from "@/actions/save-installment-link-action";
import {
  type AppliedBillingFee,
  computeAmountCents,
  formatCurrency,
} from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import {
  Check,
  CheckCircle,
  ExternalLink,
  FileText,
  Image,
  LinkIcon,
  Loader2,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
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
  const [uploadingPaymentId, setUploadingPaymentId] = useState<string | null>(null);

  const { executeAsync: saveLink, isPending: saving } = useAction(saveInstallmentLinkAction);
  const {
    execute: confirmPayment,
    status: confirmStatus,
    input: confirmInput,
  } = useAction(confirmInstallmentPaymentAction, {
    onSuccess: () => {
      toast.success("Status do pagamento atualizado!");
      onUpdate();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar pagamento");
    },
  });

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

  const handleUploadReceipt = async (paymentId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploadingPaymentId(paymentId);
    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const response = await fetch(`/api/payments/${paymentId}/receipt`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao enviar comprovante");
      }

      toast.success("Comprovante adicionado!");
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar comprovante");
    } finally {
      setUploadingPaymentId(null);
    }
  };

  return (
    <div className="space-y-3">
      {installments
        .sort((a, b) => a.installment_number - b.installment_number)
        .map((installment) => {
          const shouldComputeProfessionalAmount = !professionals && !!professionalId;
          const { totalAmountCents, totalFeesCents, totalPaidAmountCents, totalPaidFeesCents } =
            computeAmountCents(
              {
                amount: installment.amount,
                paid_amount: installment.paid_amount,
                splitted_installment: installment.splitted_installment as Record<
                  string,
                  number
                > | null,
              },
              shouldComputeProfessionalAmount ? appliedBillingFees : [],
              shouldComputeProfessionalAmount ? professionalId : undefined,
            );

          const hasPaymentDate = !!installment.paid_at;
          const hasPartialPayment = installment.status !== "pago" && !!installment.payments.length;
          const isPaid = installment.status === "pago";

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
                        <span className="font-medium">
                          {formatCurrency(
                            isPaid ? totalAmountCents : totalAmountCents - totalPaidAmountCents,
                          )}
                        </span>
                        {totalFeesCents > 0 && (
                          <span className="whitespace-nowrap text-muted-foreground text-xs">
                            {" "}
                            (taxas:{" "}
                            {formatCurrency(
                              isPaid ? totalFeesCents : totalFeesCents - totalPaidFeesCents,
                            )}
                            )
                          </span>
                        )}
                      </div>
                      <StatusBadge status={installment.status} />
                    </div>
                    <div className="flex flex-col gap-1 text-muted-foreground text-xs sm:flex-row">
                      {hasPartialPayment && (
                        <span>Parcialmente pago: {formatCurrency(totalPaidAmountCents)}</span>
                      )}
                      {installment.status !== "pago" && (
                        <span>Vencimento: {dayjs(installment.due_date).format("DD/MM/YYYY")}</span>
                      )}
                      {hasPaymentDate && (
                        <span>Pago em: {dayjs(installment.paid_at).format("DD/MM/YYYY")}</span>
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
                              <FileText className="mr-1 h-4 w-4" />
                            ) : (
                              <Image className="mr-1 h-4 w-4" />
                            )}
                            Abrir comprovante
                          </a>
                        </Button>
                      ))}
                  {installment.status === "pago" &&
                    installment.payments.length > 0 &&
                    installment.payments.every((p) => !p.receipt_url) && (
                      <label
                        className={
                          uploadingPaymentId === installment.payments[0]?.id
                            ? "pointer-events-none cursor-default opacity-50"
                            : "cursor-pointer"
                        }
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          disabled={uploadingPaymentId === installment.payments[0]?.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            const firstPayment = installment.payments[0];
                            if (file && firstPayment) {
                              handleUploadReceipt(firstPayment.id, file);
                            }
                          }}
                        />
                        <Button variant="ghost" size="sm" asChild>
                          <span>
                            {uploadingPaymentId === installment.payments[0]?.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Paperclip className="mr-1 h-4 w-4" />
                            )}
                            Anexar comprovante
                          </span>
                        </Button>
                      </label>
                    )}
                  {installment.status === "em_analise" && (
                    <div className="flex w-full items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          confirmStatus === "executing" &&
                          confirmInput?.installmentId === installment.id
                        }
                        onClick={() =>
                          confirmPayment({ installmentId: installment.id, decision: "reject" })
                        }
                      >
                        {confirmStatus === "executing" &&
                          confirmInput?.installmentId === installment.id &&
                          confirmInput.decision === "reject" && (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          )}
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          confirmStatus === "executing" &&
                          confirmInput?.installmentId === installment.id
                        }
                        onClick={() =>
                          confirmPayment({ installmentId: installment.id, decision: "confirm" })
                        }
                      >
                        {confirmStatus === "executing" &&
                          confirmInput?.installmentId === installment.id &&
                          confirmInput.decision === "confirm" && (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          )}
                        Confirmar pagamento
                      </Button>
                    </div>
                  )}
                  {installment.status !== "pago" &&
                    installment.status !== "cancelado" &&
                    installment.status !== "em_analise" && (
                      <div className="flex w-full justify-between">
                        {installment.payment_link && editingId !== installment.id && (
                          <div className="flex items-center">
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="mr-2 h-8 w-8"
                              onClick={() => handleEditLink(installment)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
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
