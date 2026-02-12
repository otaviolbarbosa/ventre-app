"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@nascere/supabase/types";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "./status-badge";

type Payment = Tables<"payments">;
type Installment = Tables<"installments"> & { payments: Payment[] };

type InstallmentListProps = {
  installments: Installment[];
  onRecordPayment: (installment: Installment) => void;
};

export function InstallmentList({ installments, onRecordPayment }: InstallmentListProps) {
  return (
    <div className="space-y-3">
      {installments
        .sort((a, b) => a.installment_number - b.installment_number)
        .map((installment) => (
          <div
            key={installment.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-sm">
                {installment.installment_number}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatCurrency(installment.amount)}
                  </span>
                  <StatusBadge status={installment.status} />
                </div>
                <div className="text-muted-foreground text-sm">
                  Vencimento: {dayjs(installment.due_date).format("DD/MM/YYYY")}
                  {installment.paid_amount > 0 && (
                    <span className="ml-2">
                      (Pago: {formatCurrency(installment.paid_amount)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {installment.payment_link && (
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
              {installment.status !== "pago" &&
                installment.status !== "cancelado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRecordPayment(installment)}
                  >
                    Registrar Pagamento
                  </Button>
                )}
            </div>
          </div>
        ))}
    </div>
  );
}
