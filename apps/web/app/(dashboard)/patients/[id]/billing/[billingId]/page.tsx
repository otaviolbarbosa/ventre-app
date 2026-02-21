"use client";

import { InstallmentList } from "@/components/billing/installment-list";
import { PaymentMethodBadge } from "@/components/billing/payment-method-badge";
import { StatusBadge } from "@/components/billing/status-badge";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculations";
import RecordPaymentModal from "@/modals/record-payment-modal";
import type { Tables } from "@nascere/supabase/types";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstallment, setSelectedInstallment] =
    useState<Installment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchBilling = useCallback(async () => {
    try {
      const response = await fetch(`/api/billing/${billingId}`);
      const data = await response.json();
      setBilling(data.billing);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [billingId]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleRecordPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    setShowPaymentModal(true);
  };

  const handleCancelBilling = async () => {
    setCancelling(true);
    try {
      const response = await fetch(`/api/billing/${billingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelado" }),
      });

      if (!response.ok) throw new Error("Erro ao cancelar cobrança");

      toast.success("Cobrança cancelada com sucesso!");
      setShowCancelModal(false);
      router.push(`/patients/${patientId}/billing`);
    } catch {
      toast.error("Erro ao cancelar cobrança");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingState />;

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
              <p className="text-muted-foreground text-sm">
                {billing.patient.name}
              </p>
            </div>
            <StatusBadge status={billing.status} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="font-semibold text-lg">
                {formatCurrency(billing.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pago</p>
              <p className="font-semibold text-green-600 text-lg">
                {formatCurrency(billing.paid_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Restante</p>
              <p className="font-semibold text-lg">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <PaymentMethodBadge method={billing.payment_method} />
            {billing.notes && (
              <span className="text-muted-foreground text-sm">
                {billing.notes}
              </span>
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
            onClick={() => setShowCancelModal(true)}
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
        onUpdate={fetchBilling}
      />

      <RecordPaymentModal
        installment={selectedInstallment}
        showModal={showPaymentModal}
        setShowModal={setShowPaymentModal}
        callback={fetchBilling}
      />

      <ConfirmModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        title="Cancelar Cobrança"
        description="Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita."
        confirmLabel="Cancelar Cobrança"
        variant="destructive"
        loading={cancelling}
        onConfirm={handleCancelBilling}
      />
    </div>
  );
}
