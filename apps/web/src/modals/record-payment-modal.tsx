"use client";

import { CurrencyInput } from "@/components/billing/currency-input";
import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import {
  type RecordPaymentInput,
  recordPaymentSchema,
} from "@/lib/validations/billing";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Installment = Tables<"installments">;

type RecordPaymentModalProps = {
  installment: Installment | null;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  callback?: VoidFunction;
};

export default function RecordPaymentModal({
  installment,
  showModal,
  setShowModal,
  callback,
}: RecordPaymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = installment
    ? installment.amount - installment.paid_amount
    : 0;

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      paid_at: dayjs().format("YYYY-MM-DD"),
      paid_amount: remaining,
      payment_method: undefined,
      notes: "",
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on installment change
  useEffect(() => {
    if (installment && showModal) {
      form.reset({
        paid_at: dayjs().format("YYYY-MM-DD"),
        paid_amount: installment.amount - installment.paid_amount,
        payment_method: installment.payment_method || undefined,
        notes: "",
      });
    }
  }, [installment, showModal]);

  async function onSubmit(data: RecordPaymentInput) {
    if (!installment) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/installments/${installment.id}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao registrar pagamento");
      }

      toast.success("Pagamento registrado com sucesso!");
      callback?.();
      setShowModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar pagamento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title="Registrar Pagamento"
      description={
        installment
          ? `Parcela ${installment.installment_number} - ${formatCurrency(installment.amount)} (Vencimento: ${dayjs(installment.due_date).format("DD/MM/YYYY")})`
          : undefined
      }
    >
      {installment && (
        <div className="mb-4 rounded-lg bg-muted p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor da parcela:</span>
            <span className="font-medium">
              {formatCurrency(installment.amount)}
            </span>
          </div>
          {installment.paid_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Já pago:</span>
              <span className="font-medium">
                {formatCurrency(installment.paid_amount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restante:</span>
            <span className="font-semibold">{formatCurrency(remaining)}</span>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="paid_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data do Pagamento</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    max={dayjs().format("YYYY-MM-DD")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paid_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Pago</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de Pagamento</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notas sobre o pagamento"
                    rows={2}
                    {...field}
                  />
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
            <Button
              type="submit"
              className="gradient-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
