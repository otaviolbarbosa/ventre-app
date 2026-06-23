"use client";

import type { AppliedBillingFee } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@ventre/supabase/types";
import { Card, CardContent, CardFooter, CardHeader } from "@ventre/ui/card";
import Link from "next/link";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";
import { TotalAmount } from "./total-amount";

type Billing = Tables<"billings"> & {
  patient: { id: string; name: string };
};

type Installment = Tables<"installments">;

export function BillingGroupCard({
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
  const totalCount = billing.installment_count;
  const sortedInstallments = [...installments].sort(
    (a, b) => a.installment_number - b.installment_number,
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">{billing.patient.name}</h3>
              <p className="text-muted-foreground text-sm">{billing.description}</p>
            </div>
          </div>
          <TotalAmount amount={monthlyAmount} />
          {/* <p className="font-semibold text-xl">{formatCurrency(monthlyAmount)}</p> */}
        </div>
      </CardHeader>

      <CardContent className="mt-2 flex-1 divide-y rounded-none border-t p-0">
        {sortedInstallments.map((installment) => {
          const splitted = installment.splitted_installment as Record<string, number> | null;
          const appliedInstallmentFees =
            installment.applied_installment_fees as unknown as AppliedBillingFee[];
          const grossDisplayAmount =
            professionalId && splitted?.[professionalId] != null
              ? splitted[professionalId]
              : installment.amount;

          return (
            <Link
              key={installment.id}
              href={`/patients/${billing.patient_id}/billing/${billing.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
            >
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
                      Pago em: <br />
                      <span className="font-medium text-foreground text-sm">
                        {dayjs(installment.paid_at).format("DD/MM/YY")}
                      </span>
                    </>
                  ) : (
                    <>
                      Venc.: <br />
                      <span className="font-medium text-foreground text-sm">
                        {dayjs(installment.due_date).format("DD/MM/YY")}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <ProfessionalNetAmount
                key={installment.id}
                professionalId={professionalId}
                professionalName=""
                grossAmountCents={grossDisplayAmount}
                appliedFees={appliedInstallmentFees}
              />
            </Link>
          );
        })}
      </CardContent>
      <CardFooter className="p-0">
        {professionals && installments && (
          <div className="w-full space-y-0.5 border-t px-4 py-2">
            {installments.map((installment) =>
              Object.entries(installment.splitted_installment as Record<string, number>).map(
                ([profId, amount]) => (
                  <ProfessionalNetAmount
                    key={profId}
                    professionalId={profId}
                    professionalName={professionals[profId] ?? profId}
                    grossAmountCents={amount}
                    appliedFees={
                      installment.applied_installment_fees as unknown as AppliedBillingFee[]
                    }
                  />
                ),
              ),
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
