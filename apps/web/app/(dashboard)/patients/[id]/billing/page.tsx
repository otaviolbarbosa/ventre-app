"use client";

import { getEnterpriseProfessionalsAction } from "@/actions/get-enterprise-professionals-action";
import { getPatientBillingsAction } from "@/actions/get-patient-billings-action";
import { BillingCard } from "@/components/billing/billing-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPatientBilling } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import NewBillingModal from "@/modals/new-billing-modal";
import type { Tables } from "@nascere/supabase/types";
import { Plus, Receipt } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string }[];
  patient: { id: string; name: string };
};

export default function PatientBillingPage() {
  const params = useParams();
  const patientId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const [showModal, setShowModal] = useState(false);
  const { isStaff } = useAuth();

  const { execute, result, isPending } = useAction(getPatientBillingsAction);
  const { execute: fetchProfessionals, result: professionalsResult } = useAction(
    getEnterpriseProfessionalsAction,
  );

  useEffect(() => {
    execute({ patientId });
    if (isStaff) fetchProfessionals({});
  }, [execute, fetchProfessionals, isStaff, patientId]);

  const billings = (result.data?.billings ?? []) as Billing[];

  const professionalsMap = isStaff
    ? Object.fromEntries(
        (professionalsResult.data?.professionals ?? []).map((p) => [p.id, p.name ?? p.id]),
      )
    : undefined;

  if (isPending && billings.length === 0) return <LoadingPatientBilling />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Cobranças</h2>
        <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nova Cobrança
        </Button>
      </div>

      {billings.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma cobrança"
          description="Crie uma cobrança para acompanhar os pagamentos desta paciente."
        >
          <Button className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nova Cobrança
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {billings.map((billing) => (
            <BillingCard key={billing.id} billing={billing} professionals={professionalsMap} />
          ))}
        </div>
      )}

      <NewBillingModal
        patientId={patientId}
        showModal={showModal}
        setShowModal={setShowModal}
        callback={() => execute({ patientId })}
        isStaff={isStaff}
        professionals={professionalsResult.data?.professionals ?? []}
      />
    </div>
  );
}
