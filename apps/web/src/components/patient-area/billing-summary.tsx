"use client";

import { registerInstallmentPaymentAction } from "@/actions/register-installment-payment-action";
import { formatCurrency, getStatusConfig } from "@/lib/billing/calculations";
import type { BillingWithInstallments } from "@/services/patient-self";
import type { Database } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ventre/ui/select";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  pix: "PIX",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export default function BillingSummary({ billings }: { billings: BillingWithInstallments[] }) {
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
      {billings.map((billing) => (
        <div key={billing.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-[#433831]">{billing.description}</p>
            <Badge variant={getStatusConfig(billing.status).variant}>
              {getStatusConfig(billing.status).label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Total: {formatCurrency(billing.total_amount)}
          </p>

          <div className="mt-3 space-y-2">
            {billing.installments
              .sort((a, b) => a.installment_number - b.installment_number)
              .map((installment) => {
                const statusConfig = getStatusConfig(installment.status);
                const canRegister =
                  installment.status === "pendente" || installment.status === "atrasado";
                const isOpen = openInstallmentId === installment.id;

                return (
                  <div key={installment.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          Parcela {installment.installment_number} —{" "}
                          {formatCurrency(installment.amount)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Vencimento {dayjs(installment.due_date).format("DD/MM/YYYY")}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {statusConfig.label}
                      </Badge>
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
          </div>
        </div>
      ))}
    </div>
  );
}
