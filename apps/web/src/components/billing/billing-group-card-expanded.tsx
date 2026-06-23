"use client";

import { type AppliedBillingFee, formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { Tables } from "@ventre/supabase/types";
import { Card, CardContent, CardHeader } from "@ventre/ui/card";
import Link from "next/link";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";

type Billing = Tables<"billings"> & {
  patient: { id: string; name: string };
};

type Installment = Tables<"installments">;

export function BillingGroupCardExpanded({
  billing,
  installments,
  professionals,
  professionalId,
}: {
  billing: Billing;
  installments: Installment[];
  professionals?: Record<string, string>;
  professionalId?: string;
}) {
  const monthlyAmount = installments.reduce((total, installment) => {
    const splittedInstallment = installment.splitted_installment as Record<string, number>;
    const amount = professionalId
      ? (splittedInstallment[professionalId] ?? 0)
      : Object.values(splittedInstallment).reduce((sum, value) => sum + value, 0);
    return total + amount;
  }, 0);
  const appliedFees = (billing.applied_billing_fees as unknown as AppliedBillingFee[]) ?? [];
  const sortedInstallments = [...installments].sort(
    (a, b) => a.installment_number - b.installment_number,
  );
  const columns = Math.min(sortedInstallments.length, 3);

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium">{billing.patient.name}</h3>
            <p className="text-muted-foreground text-sm">{billing.description}</p>
          </div>
        </div>
        <p className="font-semibold text-xl">{formatCurrency(monthlyAmount)}</p>
      </CardHeader>
      <CardContent
        className={cn(
          "grid gap-3 p-4",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {sortedInstallments.map((installment) => {
          const splitted = installment.splitted_installment as Record<string, number> | null;
          const grossDisplayAmount =
            professionalId && splitted?.[professionalId] != null
              ? splitted[professionalId]
              : installment.amount;

          return (
            <Link
              key={installment.id}
              href={`/patients/${billing.patient_id}/billing/${billing.id}`}
              className="flex flex-col space-y-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{formatCurrency(grossDisplayAmount)}</span>
                    <span className="text-muted-foreground text-sm">
                      Parcela {installment.installment_number}
                    </span>
                  </div>
                  <StatusBadge status={installment.status} />
                </div>
                <span className="text-muted-foreground text-xs">
                  {installment.paid_at ? (
                    <>Pago em: {dayjs(installment.paid_at).format("DD/MM/YYYY")}</>
                  ) : (
                    <>Venc.: {dayjs(installment.due_date).format("DD/MM/YYYY")}</>
                  )}
                </span>
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
                        appliedFees={appliedFees}
                      />
                    ),
                  )}
                </div>
              )}
              {!professionals && professionalId && appliedFees.length > 0 && (
                <div className="border-t pt-2">
                  <ProfessionalNetAmount
                    professionalId={professionalId}
                    grossAmountCents={grossDisplayAmount}
                    appliedFees={appliedFees}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
