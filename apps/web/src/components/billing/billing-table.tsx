"use client";

import { type AppliedBillingFee, formatCurrency } from "@/lib/billing/calculations";
import type { GroupedBilling } from "@/lib/billing/dashboard";
import { dayjs } from "@/lib/dayjs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ventre/ui/table";
import { useRouter } from "next/navigation";
import { ProfessionalNetAmount } from "./professional-net-amount";
import { StatusBadge } from "./status-badge";
import { TotalAmount } from "./total-amount";

type BillingTableProps = {
  billings: GroupedBilling[];
  professionals?: Record<string, string>;
  professionalId?: string;
};

export function BillingTable({ billings, professionals, professionalId }: BillingTableProps) {
  const router = useRouter();

  const rows = billings.flatMap((billing) =>
    [...billing.filteredInstallments]
      .sort((a, b) => a.installment_number - b.installment_number)
      .map((installment) => ({ billing, installment })),
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gestante</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ billing, installment }) => {
            const splitted = installment.splitted_installment as Record<string, number> | null;
            const monthlyAmount = professionalId
              ? (splitted?.[professionalId] ?? 0)
              : Object.values(splitted || {}).reduce((acc, curr) => acc + curr, 0);
            const appliedInstallmentFees =
              installment.applied_installment_fees as unknown as AppliedBillingFee[];
            const grossDisplayAmount =
              professionalId && splitted?.[professionalId] != null
                ? splitted[professionalId]
                : installment.amount;

            return (
              <TableRow
                key={installment.id}
                className="cursor-pointer"
                onClick={() => router.push(`/patients/${billing.patient_id}/billing/${billing.id}`)}
              >
                <TableCell className="font-medium">{billing.patient.name}</TableCell>
                <TableCell className="text-muted-foreground">{billing.description}</TableCell>
                <TableCell className="text-muted-foreground">
                  {installment.installment_number}/{billing.installment_count}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {installment.paid_at ? (
                    <>Pago em {dayjs(installment.paid_at).format("DD/MM/YYYY")}</>
                  ) : (
                    <>Venc. {dayjs(installment.due_date).format("DD/MM/YYYY")}</>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={installment.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex w-full flex-col items-end">
                    <TotalAmount amount={monthlyAmount} />
                    {professionals ? (
                      <div className="w-full space-y-0.5">
                        {Object.entries(splitted ?? {}).map(([profId, amount]) => (
                          <ProfessionalNetAmount
                            key={profId}
                            professionalId={profId}
                            professionalName={professionals?.[profId] ?? " "}
                            grossAmountCents={amount}
                            appliedFees={appliedInstallmentFees}
                          />
                        ))}
                      </div>
                    ) : professionalId ? (
                      <ProfessionalNetAmount
                        professionalId={professionalId}
                        professionalName=" "
                        grossAmountCents={grossDisplayAmount}
                        appliedFees={appliedInstallmentFees}
                      />
                    ) : (
                      <span className="font-medium text-sm">
                        {formatCurrency(grossDisplayAmount)}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
