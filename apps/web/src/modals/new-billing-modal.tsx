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
import {
  type CreateBillingInput,
  createBillingSchema,
} from "@/lib/validations/billing";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

type NewBillingModalProps = {
  patientId: string;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  callback?: VoidFunction;
};

export default function NewBillingModal({
  patientId,
  showModal,
  setShowModal,
  callback,
}: NewBillingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateBillingInput>({
    resolver: zodResolver(createBillingSchema),
    defaultValues: {
      patient_id: patientId,
      description: "",
      total_amount: 0,
      payment_method: undefined,
      installment_count: 1,
      installment_interval: 1,
      first_due_date: "",
      payment_links: [],
      notes: "",
    },
  });

  const installmentCount = form.watch("installment_count");

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "payment_links" as never,
  });

  // Sync payment_links array with installment_count
  useEffect(() => {
    const currentLinks = form.getValues("payment_links") || [];
    const count = installmentCount || 1;
    if (currentLinks.length !== count) {
      const newLinks = Array.from(
        { length: count },
        (_, i) => currentLinks[i] || "",
      );
      replace(newLinks as never[]);
    }
  }, [installmentCount, form, replace]);

  async function onSubmit(data: CreateBillingInput) {
    setIsSubmitting(true);

    try {
      // Filter out empty payment links
      const cleanedData = {
        ...data,
        payment_links: data.payment_links?.filter((link) => link !== "") || [],
      };

      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar cobrança");
      }

      toast.success("Cobrança criada com sucesso!");
      callback?.();
      setShowModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar cobrança",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (showModal) {
      form.reset({
        patient_id: patientId,
        description: "",
        total_amount: 0,
        payment_method: undefined,
        installment_count: 1,
        installment_interval: 1,
        first_due_date: "",
        payment_links: [],
        notes: "",
      });
    }
  }, [showModal]);

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title="Nova Cobrança"
      description="Crie uma nova cobrança para a paciente"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Acompanhamento pré-natal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Total</FormLabel>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="installment_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parcelas</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="installment_interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intervalo</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Mensal</SelectItem>
                      <SelectItem value="2">Bimestral</SelectItem>
                      <SelectItem value="3">Trimestral</SelectItem>
                      <SelectItem value="4">Quadrimestral</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="first_due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento da 1ª parcela</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {fields.length > 0 && (
            <div className="space-y-2">
              <FormLabel>Links de Pagamento (opcional)</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="w-8 text-center text-muted-foreground text-sm">
                    {index + 1}
                  </span>
                  <Input
                    placeholder="https://..."
                    {...form.register(`payment_links.${index}`)}
                  />
                  {form.watch(`payment_links.${index}`) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        form.setValue(`payment_links.${index}`, "")
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notas sobre a cobrança"
                    rows={3}
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
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
