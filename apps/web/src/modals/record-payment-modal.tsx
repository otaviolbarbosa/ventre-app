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
import { type RecordPaymentInput, recordPaymentSchema } from "@/lib/validations/billing";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase/types";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = installment ? installment.amount - installment.paid_amount : 0;

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
      setReceiptFile(null);
    }
  }, [installment, showModal]);

  async function onSubmit(data: RecordPaymentInput) {
    if (!installment) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("paid_at", data.paid_at);
      formData.append("paid_amount", String(data.paid_amount));
      formData.append("payment_method", data.payment_method);
      if (data.notes) formData.append("notes", data.notes);
      if (receiptFile) formData.append("receipt", receiptFile);

      const response = await fetch(`/api/installments/${installment.id}/payments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao registrar pagamento");
      }

      toast.success("Pagamento registrado com sucesso!");
      callback?.();
      setShowModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar pagamento");
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            <span className="font-medium">{formatCurrency(installment.amount)}</span>
          </div>
          {installment.paid_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Já pago:</span>
              <span className="font-medium">{formatCurrency(installment.paid_amount)}</span>
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
                  <Input type="date" max={dayjs().format("YYYY-MM-DD")} {...field} />
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
                  <CurrencyInput value={field.value} onChange={field.onChange} />
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
                  <Textarea placeholder="Notas sobre o pagamento" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Comprovante (opcional)</FormLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > 10 * 1024 * 1024) {
                  toast.error("Arquivo muito grande. Máximo 10MB.");
                  return;
                }
                setReceiptFile(file);
              }}
            />
            {receiptFile ? (
              <div className="flex items-center gap-2 rounded-lg border p-3">
                {receiptFile.type === "application/pdf" ? (
                  <FileText className="h-5 w-5 shrink-0 text-red-500" />
                ) : (
                  <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{receiptFile.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(receiptFile.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setReceiptFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-1.5 w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Anexar comprovante
              </Button>
            )}
          </div>

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
              Registrar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
