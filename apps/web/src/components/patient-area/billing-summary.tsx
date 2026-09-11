"use client";

import { registerInstallmentPaymentAction } from "@/actions/register-installment-payment-action";
import { StatusBadge } from "@/components/billing/status-badge";
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { BillingWithInstallments } from "@/services/patient-self";
import type { Database } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Card, CardContent, CardHeader } from "@ventre/ui/card";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { CircleDollarSign, Loader2, Paperclip } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CurrencyInput } from "../billing/currency-input";
import { TotalAmount } from "../billing/total-amount";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  pix: "PIX",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export default function BillingSummary({
  billings,
  professionals,
}: {
  billings: BillingWithInstallments[];
  professionals: Record<string, string>;
}) {
  const router = useRouter();
  const [openInstallmentId, setOpenInstallmentId] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    Database["public"]["Enums"]["payment_method"] | ""
  >("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  const { execute, isPending } = useAction(registerInstallmentPaymentAction, {
    onSuccess: () => {
      toast.success("Pagamento registrado! Aguardando confirmação da equipe.");
      setOpenInstallmentId(null);
      setPaidAt(dayjs().format("YYYY-MM-DD"));
      setPaidAmount(0);
      setPaymentMethod("");
      setReceiptFile(null);
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao registrar pagamento");
    },
  });

  function handleReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Envie imagens ou PDF.");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      toast.error("O comprovante deve ter até 10MB.");
      return;
    }
    setReceiptFile(file);
  }

  if (billings.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
        Nenhuma cobrança registrada.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {billings.map((billing) => {
        const sortedInstallments = [...billing.installments].sort(
          (a, b) => a.installment_number - b.installment_number,
        );
        const totalCount = sortedInstallments.length;

        return (
          <Card key={billing.id} className="flex flex-col">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <h3 className="font-medium">{billing.description}</h3>
                  <StatusBadge status={billing.status} isPatient />
                </div>
                <p className="text-muted-foreground text-sm">
                  <TotalAmount amount={billing.total_amount} />
                  {/* {formatCurrency(billing.total_amount)} */}
                </p>
              </div>

              {billing.splitted_billing && (
                <div className="mt-2 space-y-0.5 border-t pt-2">
                  {Object.entries(billing.splitted_billing as Record<string, number>).map(
                    ([professionalId, amount]) => (
                      <div
                        key={professionalId}
                        className="flex justify-between text-muted-foreground text-xs"
                      >
                        <span>{professionals[professionalId] ?? "Profissional"}</span>
                        <span>{formatCurrency(amount)}</span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="mt-2 flex-1 divide-y rounded-none border-t p-0">
              {sortedInstallments.map((installment) => {
                const canRegister =
                  installment.status === "pendente" || installment.status === "atrasado";
                const isOpen = openInstallmentId === installment.id;
                const paidCents = installment.payments.reduce(
                  (sum, payment) => sum + payment.paid_amount,
                  0,
                );
                const dueCents = installment.amount - paidCents;
                const hasPartialPayment = canRegister && paidCents > 0;

                return (
                  <div key={installment.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {totalCount > 1 && (
                          <span className="text-muted-foreground">
                            {installment.installment_number}/{totalCount}
                          </span>
                        )}
                        <div className="flex flex-col justify-center gap-1">
                          <div className="font-medium">{formatCurrency(dueCents)}</div>

                          {hasPartialPayment && (
                            <span className="text-muted-foreground text-xs">
                              Pago parcialmente:{" "}
                              <span className="font-medium">{formatCurrency(paidCents)}</span>
                            </span>
                          )}
                          {installment.paid_at ? (
                            <div className="text-muted-foreground text-xs">
                              Pago em:{" "}
                              <span className="font-medium">
                                {dayjs(installment.paid_at).format("DD/MM/YY")}
                              </span>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              Vencimento:{" "}
                              <span className="font-medium">
                                {dayjs(installment.due_date).format("DD/MM/YY")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        {/* <div className="flex flex-col items-start gap-3 sm:flex-row"> */}

                        <StatusBadge status={installment.status} isPatient />
                        {/* </div> */}
                      </div>
                    </div>

                    {canRegister && !isOpen && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            setPaidAt(dayjs().format("YYYY-MM-DD"));
                            setPaidAmount(dueCents);
                            setReceiptFile(null);
                            setOpenInstallmentId(installment.id);
                          }}
                        >
                          <CircleDollarSign className="h-4 w-4" />
                          Registrar pagamento
                        </Button>
                      </div>
                    )}

                    {canRegister && isOpen && (
                      <div className="mt-2 space-y-3">
                        <div>
                          <Label className="mb-1.5 block">Data do pagamento</Label>
                          <DatePicker
                            selected={paidAt ? new Date(`${paidAt}T00:00:00`) : null}
                            onChange={(date) =>
                              setPaidAt(date ? date.toISOString().slice(0, 10) : "")
                            }
                            placeholderText="Selecione a data"
                            maxDate={new Date()}
                          />
                        </div>

                        <div>
                          <Label className="mb-1.5 block">Valor pago</Label>
                          <CurrencyInput value={paidAmount} onChange={setPaidAmount} />
                        </div>

                        <div>
                          <Label className="mb-1.5 block">Método de pagamento</Label>
                          <Select
                            value={paymentMethod}
                            onValueChange={(value) =>
                              setPaymentMethod(
                                value as Database["public"]["Enums"]["payment_method"],
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o método" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="mb-1.5 block">Comprovante (opcional)</Label>
                          <input
                            ref={receiptFileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleReceiptFileChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => receiptFileInputRef.current?.click()}
                          >
                            <Paperclip className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {receiptFile ? receiptFile.name : "Anexar comprovante"}
                            </span>
                          </Button>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setOpenInstallmentId(null);
                              setReceiptFile(null);
                            }}
                            disabled={isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={!paymentMethod || !paidAt || paidAmount <= 0 || isPending}
                            onClick={() => {
                              if (!paymentMethod || !paidAt || paidAmount <= 0) return;
                              execute({
                                installmentId: installment.id,
                                paidAt,
                                paidAmount,
                                paymentMethod,
                                receiptFile: receiptFile ?? undefined,
                              });
                            }}
                          >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
