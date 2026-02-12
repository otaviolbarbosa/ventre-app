"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculations";
import type { Tables } from "@nascere/supabase/types";
import Link from "next/link";
import { StatusBadge } from "./status-badge";
import { PaymentMethodBadge } from "./payment-method-badge";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string }[];
  patient: { id: string; name: string };
};

export function BillingCard({ billing }: { billing: Billing }) {
  const paidCount = billing.installments.filter((i) => i.status === "pago").length;
  const totalCount = billing.installments.length;
  const progressPercent =
    billing.total_amount > 0
      ? Math.round((billing.paid_amount / billing.total_amount) * 100)
      : 0;

  return (
    <Link href={`/patients/${billing.patient_id}/billing/${billing.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">{billing.description}</h3>
              <p className="text-muted-foreground text-sm">{billing.patient.name}</p>
            </div>
            <StatusBadge status={billing.status} />
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold text-lg">
                {formatCurrency(billing.total_amount)}
              </span>
              {billing.paid_amount > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({formatCurrency(billing.paid_amount)} pago)
                </span>
              )}
            </div>
            <PaymentMethodBadge method={billing.payment_method} />
          </div>

          {totalCount > 1 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                <span>
                  {paidCount} de {totalCount} parcelas
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
