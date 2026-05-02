"use client";

import { getBillingAction } from "@/actions/get-billing-action";
import { getEnterpriseProfessionalsAction } from "@/actions/get-enterprise-professionals-action";
import { updateBillingAction } from "@/actions/update-billing-action";
import { InstallmentList } from "@/components/billing/installment-list";
import { PaymentMethodBadge } from "@/components/billing/payment-method-badge";
import { StatusBadge } from "@/components/billing/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/billing/calculations";
import RecordPaymentModal from "@/modals/record-payment-modal";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Payment = Tables<"payments">;
type Installment = Tables<"installments"> & { payments: Payment[] };
type Billing = Tables<"billings"> & {
  installments: Installment[];
  patient: { id: string; name: string };
};

export default function BillingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billingId = params.billingId as string;
  const patientId = params.id as string;
  const { isStaff } = useAuth();

  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { confirm } = useConfirmModal();

  const { execute: fetchBilling, result, isPending } = useAction(getBillingAction);
  const { executeAsync: cancelBilling } = useAction(updateBillingAction);
  const { execute: fetchProfessionals, result: professionalsResult } = useAction(
    getEnterpriseProfessionalsAction,
  );

  useEffect(() => {
    fetchBilling({ billingId });
    if (isStaff) fetchProfessionals({});
  }, [fetchBilling, fetchProfessionals, isStaff, billingId]);

  const billing = result.data?.billing as Billing | undefined;

  const professionalsMap = isStaff
    ? Object.fromEntries(
        (professionalsResult.data?.professionals ?? []).map((p) => [p.id, p.name ?? p.id]),
      )
    : undefined;

  const handleRecordPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    setShowPaymentModal(true);
  };

  function handleConfirmCancelBilling() {
    confirm({
      title: "Cancelar Cobrança",
      description:
        "Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.",
      confirmLabel: "Cancelar Cobrança",
      variant: "destructive",
      onConfirm: async () => {
        const result = await cancelBilling({ billingId, status: "cancelado" });
        if (result?.serverError) {
          toast.error("Erro ao cancelar cobrança");
          return;
        }
        toast.success("Cobrança cancelada com sucesso!");
        router.push(`/patients/${patientId}/billing`);
      },
    });
  }

  if (isPending && !billing) return <LoadingState />;

  if (!billing) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Cobrança não encontrada.</p>
        <Link
          href={`/patients/${patientId}/billing`}
          className="mt-2 inline-flex items-center text-primary text-sm"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </div>
    );
  }

  const remaining = billing.total_amount - billing.paid_amount;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/patients/${patientId}/billing`}
          className="inline-flex items-center text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar para cobranças
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-lg">{billing.description}</h2>
              <p className="text-muted-foreground text-sm">{billing.patient.name}</p>
            </div>
            <StatusBadge status={billing.status} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="font-semibold text-lg">{formatCurrency(billing.total_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pago</p>
              <p className="font-semibold text-green-600 text-lg">
                {formatCurrency(billing.paid_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Restante</p>
              <p className="font-semibold text-lg">{formatCurrency(remaining)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <PaymentMethodBadge method={billing.payment_method} />
            {billing.notes && (
              <span className="text-muted-foreground text-sm">{billing.notes}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Parcelas</h3>
        {billing.status !== "cancelado" && billing.status !== "pago" && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleConfirmCancelBilling}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Cancelar Cobrança
          </Button>
        )}
      </div>

      <InstallmentList
        billingId={billingId}
        installments={billing.installments}
        onRecordPayment={handleRecordPayment}
        onUpdate={() => fetchBilling({ billingId })}
        professionals={professionalsMap}
      />

      <RecordPaymentModal
        installment={selectedInstallment}
        paymentMethod={billing.payment_method}
        showModal={showPaymentModal}
        setShowModal={setShowPaymentModal}
        callback={() => fetchBilling({ billingId })}
      />
    </div>
  );
}
