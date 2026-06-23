"use client";

import {
  type AppliedBillingFee,
  computeNetAmountCents,
  formatCurrency,
} from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@ventre/supabase/types";
import { Card, CardContent, CardFooter, CardHeader } from "@ventre/ui/card";
import Link from "next/link";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";

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
  const appliedFees = (billing.applied_billing_fees as unknown as AppliedBillingFee[]) ?? [];
  const totalCount = billing.installment_count;
  const sortedInstallments = [...installments].sort(
    (a, b) => a.installment_number - b.installment_number,
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium">{billing.patient.name}</h3>
            <p className="text-muted-foreground text-sm">{billing.description}</p>
          </div>
          <StatusBadge status={billing.status} />
        </div>
        <p className="font-semibold text-xl">{formatCurrency(billing.total_amount)}</p>
      </CardHeader>

      <CardContent className="mt-2 flex-1 divide-y rounded-none border-t p-0">
        {sortedInstallments.map((installment) => {
          const splitted = installment.splitted_installment as Record<string, number> | null;
          const grossDisplayAmount =
            professionalId && splitted?.[professionalId] != null
              ? splitted[professionalId]
              : installment.amount;
          const { netAmountCents } = professionalId
            ? computeNetAmountCents(grossDisplayAmount, appliedFees, professionalId)
            : { netAmountCents: grossDisplayAmount };

          return (
            <Link
              key={installment.id}
              href={`/patients/${billing.patient_id}/billing/${billing.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                {totalCount > 1 && (
                  <span className="text-muted-foreground">
                    {installment.installment_number}/{totalCount}
                  </span>
                )}
                <StatusBadge status={installment.status} />
                <span className="truncate text-muted-foreground text-xs">
                  {installment.paid_at ? (
                    <>Pago em: {dayjs(installment.paid_at).format("DD/MM/YYYY")}</>
                  ) : (
                    <>Venc.: {dayjs(installment.due_date).format("DD/MM/YYYY")}</>
                  )}
                </span>
              </div>
              <ProfessionalNetAmount
                key={installment.id}
                professionalId={
                  Object.keys(installment.splitted_installment as Record<string, number>)?.at(0) ??
                  ""
                }
                professionalName=""
                grossAmountCents={netAmountCents}
                appliedFees={appliedFees}
              />
            </Link>
          );
        })}
      </CardContent>
      <CardFooter className="p-0">
        {professionals && billing.splitted_billing && (
          <div className="w-full space-y-0.5 border-t px-4 py-2">
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
      </CardFooter>
    </Card>
  );
}
