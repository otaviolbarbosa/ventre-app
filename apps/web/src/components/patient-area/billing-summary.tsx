"use client";

import { registerInstallmentPaymentAction } from "@/actions/register-installment-payment-action";
import { StatusBadge } from "@/components/billing/status-badge";
import { formatCurrency } from "@/lib/billing/calculations";
import type { BillingWithInstallments } from "@/services/patient-self";
import type { Database } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Card, CardContent, CardHeader } from "@ventre/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TotalAmount } from "../billing/total-amount";

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
  const [paymentMethod, setPaymentMethod] = useState<
    Database["public"]["Enums"]["payment_method"] | ""
  >("");

  const { execute, isPending } = useAction(registerInstallmentPaymentAction, {
    onSuccess: () => {
      toast.success("Pagamento registrado! Aguardando confirmação da equipe.");
      setOpenInstallmentId(null);
      setPaymentMethod("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao registrar pagamento");
    },
  });

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
                <div className="flex flex-1 items-center gap-2">
                  <h3 className="truncate font-medium">{billing.description}</h3>
                  <StatusBadge status={billing.status} />
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

                return (
                  <div key={installment.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {totalCount > 1 && (
                          <span className="text-muted-foreground">
                            {installment.installment_number}/{totalCount}
                          </span>
                        )}
                        <StatusBadge status={installment.status} />
                        <span className="truncate text-muted-foreground text-xs">
                          {installment.paid_at ? (
                            <>
                              Pago em:{" "}
                              <span className="font-medium text-foreground text-sm">
                                {dayjs(installment.paid_at).format("DD/MM/YY")}
                              </span>
                            </>
                          ) : (
                            <>
                              Venc.:{" "}
                              <span className="font-medium text-foreground text-sm">
                                {dayjs(installment.due_date).format("DD/MM/YY")}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <span className="font-medium">{formatCurrency(installment.amount)}</span>
                    </div>

                    {canRegister && !isOpen && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => setOpenInstallmentId(installment.id)}
                      >
                        Registrar pagamento
                      </Button>
                    )}

                    {canRegister && isOpen && (
                      <div className="mt-2 space-y-2">
                        <Select
                          value={paymentMethod}
                          onValueChange={(value) =>
                            setPaymentMethod(value as Database["public"]["Enums"]["payment_method"])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Método de pagamento" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setOpenInstallmentId(null)}
                            disabled={isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={!paymentMethod || isPending}
                            onClick={() => {
                              if (!paymentMethod) return;
                              execute({ installmentId: installment.id, paymentMethod });
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
