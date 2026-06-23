"use client";

import { toggleBillingFeeActiveAction } from "@/actions/toggle-billing-fee-active-action";
import { Header } from "@/components/layouts/header";
import { BillingFeeCard } from "@/components/shared/billing-fee-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import BillingFeeFormModal from "@/modals/billing-fee-form-modal";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { Percent, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type BillingDeductionsScreenProps = {
  fees: Tables<"enterprise_billing_fees">[];
};

export default function BillingDeductionsScreen({ fees }: BillingDeductionsScreenProps) {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [showFormModal, setShowFormModal] = useState(false);
  const [feeToEdit, setFeeToEdit] = useState<Tables<"enterprise_billing_fees"> | null>(null);

  const { executeAsync: executeToggle } = useAction(toggleBillingFeeActiveAction, {
    onSuccess: () => {
      toast.success("Taxa atualizada com sucesso");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao atualizar taxa"),
  });

  function handleEdit(fee: Tables<"enterprise_billing_fees">) {
    setFeeToEdit(fee);
    setShowFormModal(true);
  }

  function handleToggleActive(fee: Tables<"enterprise_billing_fees">) {
    if (fee.is_active) {
      confirm({
        title: "Desativar taxa",
        description: `Tem certeza que deseja desativar "${fee.name}"? Cobranças futuras deixarão de receber essa taxa.`,
        confirmLabel: "Desativar",
        variant: "destructive",
        onConfirm: async () => {
          await executeToggle({ id: fee.id, is_active: false });
        },
      });
      return;
    }

    executeToggle({ id: fee.id, is_active: true });
  }

  function handleNewFee() {
    setFeeToEdit(null);
    setShowFormModal(true);
  }

  return (
    <div>
      <Header title="Taxas e Descontos" back="/settings" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="Configure taxas fixas e percentuais aplicadas às cobranças">
          <Button size="icon" className="gradient-primary flex sm:hidden" onClick={handleNewFee}>
            <Plus className="size-4" />
          </Button>
          <Button className="gradient-primary hidden sm:flex" onClick={handleNewFee}>
            <Plus className="size-4" />
            Nova taxa
          </Button>
        </PageHeader>

        {fees.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="Nenhuma taxa cadastrada"
            description="Cadastre taxas fixas ou percentuais para aplicar nas cobranças."
          >
            <Button onClick={handleNewFee}>
              <Plus className="size-4" />
              Nova taxa
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fees.map((fee) => (
              <BillingFeeCard
                key={fee.id}
                fee={fee}
                onEdit={() => handleEdit(fee)}
                onToggleActive={() => handleToggleActive(fee)}
              />
            ))}
          </div>
        )}
      </div>

      <BillingFeeFormModal
        fee={feeToEdit}
        showModal={showFormModal}
        setShowModal={setShowFormModal}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
