"use client";

import { CurrencyInput } from "@/components/billing/currency-input";
import { createBillingFeeAction } from "@/actions/create-billing-fee-action";
import { updateBillingFeeAction } from "@/actions/update-billing-fee-action";
import {
  type CreateBillingFeeInput,
  createBillingFeeSchema,
} from "@/lib/validations/enterprise-billing-fees";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type BillingFeeFormModalProps = {
  fee?: Tables<"enterprise_billing_fees"> | null;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: () => void;
};

export default function BillingFeeFormModal({
  fee,
  showModal,
  setShowModal,
  onSuccess,
}: BillingFeeFormModalProps) {
  const isEdit = !!fee;

  const form = useForm<CreateBillingFeeInput>({
    resolver: zodResolver(createBillingFeeSchema),
    defaultValues: {
      name: fee?.name ?? "",
      fee_type: fee?.fee_type ?? "fixed",
      value: fee?.value ?? 0,
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on fee/showModal change
  useEffect(() => {
    if (showModal) {
      form.reset({
        name: fee?.name ?? "",
        fee_type: fee?.fee_type ?? "fixed",
        value: fee?.value ?? 0,
      });
    }
  }, [fee, showModal]);

  const feeType = form.watch("fee_type");

  const { executeAsync: executeCreate, isExecuting: isCreating } = useAction(createBillingFeeAction);
  const { executeAsync: executeUpdate, isExecuting: isUpdating } = useAction(updateBillingFeeAction);

  const isSubmitting = isCreating || isUpdating;

  async function onSubmit(data: CreateBillingFeeInput) {
    const result = isEdit
      ? await executeUpdate({ id: fee.id, name: data.name, value: data.value })
      : await executeCreate(data);

    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }

    toast.success(isEdit ? "Taxa atualizada com sucesso" : "Taxa criada com sucesso");
    form.reset();
    onSuccess?.();
    setShowModal(false);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title={isEdit ? "Editar taxa" : "Nova taxa"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Taxa de cartão" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fee_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fixed">Fixo (R$)</SelectItem>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor</FormLabel>
                <FormControl>
                  {feeType === "fixed" ? (
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  ) : (
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="pr-8"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
