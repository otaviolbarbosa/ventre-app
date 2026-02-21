"use client";

import { BillingCard } from "@/components/billing/billing-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import NewBillingModal from "@/modals/new-billing-modal";
import type { Tables } from "@nascere/supabase/types";
import { Plus, Receipt } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Billing = Tables<"billings"> & {
  installments: { id: string; status: string }[];
  patient: { id: string; name: string };
};

export default function PatientBillingPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchBillings = useCallback(async () => {
    try {
      const response = await fetch(`/api/billing?patient_id=${patientId}`);
      const data = await response.json();
      setBillings(data.billings || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchBillings();
  }, [fetchBillings]);

  if (loading) return <LoadingState />;

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
            <BillingCard key={billing.id} billing={billing} />
          ))}
        </div>
      )}

      <NewBillingModal
        patientId={patientId}
        showModal={showModal}
        setShowModal={setShowModal}
        callback={fetchBillings}
      />
    </div>
  );
}
