"use client";

import { type AppliedBillingFee, formatCurrency } from "@/lib/billing/calculations";
import type { Tables } from "@ventre/supabase/types";
import { Card, CardContent } from "@ventre/ui/card";
import Link from "next/link";
import { PaymentMethodBadge } from "./payment-method-badge";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string }[];
  patient: { id: string; name: string };
};

export function BillingCard({
  billing,
  professionals,
  professionalId,
}: {
  billing: Billing;
  professionals?: Record<string, string>;
  professionalId?: string;
}) {
  const appliedFees = (billing.applied_billing_fees as unknown as AppliedBillingFee[]) ?? [];
  const paidCount = billing.installments.filter((i) => i.status === "pago").length;
  const totalCount = billing.installments.length;

  const splittedBilling = billing.splitted_billing as Record<string, number> | null;
  const professionalGrossAmountCents =
    !professionals && professionalId && splittedBilling
      ? (splittedBilling[professionalId] ?? billing.total_amount)
      : undefined;

  const displayTotalAmount = professionalGrossAmountCents ?? billing.total_amount;
  const paidRatio = billing.total_amount > 0 ? billing.paid_amount / billing.total_amount : 0;
  const displayPaidAmount =
    professionalGrossAmountCents !== undefined
      ? Math.round(professionalGrossAmountCents * paidRatio)
      : billing.paid_amount;

  const progressPercent =
    displayTotalAmount > 0 ? Math.round((displayPaidAmount / displayTotalAmount) * 100) : 0;

  return (
    <Link href={`/patients/${billing.patient_id}/billing/${billing.id}`} className="block">
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
              <span className="font-semibold text-lg">{formatCurrency(displayTotalAmount)}</span>
              {displayPaidAmount > 0 && (
                <span className="ml-2 whitespace-nowrap text-muted-foreground">
                  ({formatCurrency(displayPaidAmount)} pago)
                </span>
              )}
            </div>
            <PaymentMethodBadge method={billing.payment_method} />
          </div>

          {professionals && billing.splitted_billing && (
            <div className="mt-2 space-y-0.5 border-t pt-2">
              {Object.entries(billing.splitted_billing as Record<string, number>).map(
                ([profId, amount]) => (
                  <ProfessionalNetAmount
                    key={profId}
                    professionalId={profId}
                    professionalName={professionals[profId] ?? profId}
                    grossAmountCents={amount}
                    appliedFees={appliedFees}
                  />
                ),
              )}
            </div>
          )}
          {professionalGrossAmountCents !== undefined && professionalId && (
            <div className="mt-2 border-t pt-2">
              <ProfessionalNetAmount
                professionalId={professionalId}
                grossAmountCents={professionalGrossAmountCents}
                appliedFees={appliedFees}
              />
            </div>
          )}

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
