"use client";

import { addBillingAction } from "@/actions/add-billing-action";
import { CurrencyInput } from "@/components/billing/currency-input";
import { MultiSelectDropdown } from "@/components/shared/multi-select-dropdown";
import {
  calculateInstallmentAmount,
  calculateInstallmentDates,
  formatCurrency,
} from "@/lib/billing/calculations";
import { type CreateBillingInput, createBillingSchema } from "@/lib/validations/billing";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2, Pencil, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Professional = { id: string; name: string | null };

type NewBillingModalProps = {
  patientId: string;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  callback?: VoidFunction;
  isStaff?: boolean;
  professionals?: Professional[];
};

export default function NewBillingModal({
  patientId,
  showModal,
  setShowModal,
  callback,
  isStaff,
  professionals = [],
}: NewBillingModalProps) {
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [profAmounts, setProfAmounts] = useState<Record<string, number>>({});

  const { execute, status } = useAction(addBillingAction, {
    onSuccess: () => {
      toast.success("Cobrança criada com sucesso!");
      callback?.();
      setShowModal(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar cobrança");
    },
  });

  const isSubmitting = status === "executing";

  const form = useForm<CreateBillingInput>({
    resolver: zodResolver(createBillingSchema),
    defaultValues: {
      patient_id: patientId,
      description: "",
      total_amount: 0,
      payment_method: undefined,
      installment_count: 1,
      installment_interval: 1,
      first_due_date: new Date().toISOString().split("T")[0],
      installments_dates: [],
      payment_links: [],
      notes: "",
    },
  });

  const installmentCount = form.watch("installment_count");
  const installmentInterval = form.watch("installment_interval");
  const firstDueDate = form.watch("first_due_date");
  const totalAmount = isStaff
    ? Object.values(profAmounts).reduce((a, b) => a + b, 0)
    : (form.watch("total_amount") ?? 0);

  const installmentAmounts = useMemo(
    () => calculateInstallmentAmount(totalAmount ?? 0, installmentCount),
    [totalAmount, installmentCount],
  );

  // Pre-calculated dates from first_due_date + interval (installments 2..n)
  const previewDates = useMemo<string[]>(() => {
    if (isCustomInterval || !firstDueDate || !installmentInterval || installmentCount <= 1) {
      return [];
    }
    return calculateInstallmentDates(firstDueDate, installmentCount, installmentInterval).slice(1);
  }, [isCustomInterval, firstDueDate, installmentInterval, installmentCount]);

  function switchToCustom(seedDates?: string[]) {
    const first = form.getValues("first_due_date") ?? "";
    const interval = form.getValues("installment_interval") ?? 1;
    const count = form.getValues("installment_count");

    const dates =
      seedDates ??
      (first
        ? calculateInstallmentDates(first, count, interval as number)
        : Array.from({ length: count }, () => ""));

    setIsCustomInterval(true);
    form.setValue("installment_interval", null);
    form.setValue("first_due_date", null);
    form.setValue("installments_dates", dates);
  }

  function handleIntervalChange(value: string) {
    if (value === "custom") {
      switchToCustom();
    } else {
      setIsCustomInterval(false);
      form.setValue("installment_interval", Number(value));
      form.setValue("installments_dates", []);
    }
  }

  // Adjust installments_dates length when count changes in custom mode
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (!isCustomInterval) return;
    const current = form.getValues("installments_dates") ?? [];
    const next = Array.from({ length: installmentCount }, (_, i) => current[i] ?? "");
    form.setValue("installments_dates", next);
  }, [installmentCount, isCustomInterval]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (showModal) {
      setIsCustomInterval(false);
      setProfAmounts({});
      form.reset({
        patient_id: patientId,
        description: "",
        total_amount: isStaff ? undefined : 0,
        payment_method: undefined,
        installment_count: 1,
        installment_interval: 1,
        first_due_date: new Date().toISOString().split("T")[0],
        installments_dates: [],
        payment_links: [],
        notes: "",
      });
    }
  }, [showModal]);

  function onSubmit(data: CreateBillingInput) {
    if (isStaff) {
      const selectedIds = Object.keys(profAmounts);
      if (selectedIds.length === 0) {
        toast.error("Selecione ao menos uma profissional e informe o valor.");
        return;
      }
      const hasZero = Object.values(profAmounts).some((v) => v <= 0);
      if (hasZero) {
        toast.error("Todos os valores das profissionais devem ser maiores que zero.");
        return;
      }
    }

    const cleanedData = {
      ...data,
      total_amount: isStaff ? undefined : data.total_amount,
      splitted_billing: isStaff ? profAmounts : undefined,
      installment_interval: isCustomInterval ? null : data.installment_interval,
      first_due_date: isCustomInterval ? null : data.first_due_date,
      payment_links: data.payment_links?.filter((link) => link !== "") || [],
    };
    execute(cleanedData);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title="Nova Cobrança"
      description="Crie uma nova cobrança para a gestante"
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

          {isStaff ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <FormLabel>Profissionais e Valores</FormLabel>
                <MultiSelectDropdown
                  options={professionals.map((p) => ({ id: p.id, label: p.name ?? p.id }))}
                  selected={Object.keys(profAmounts)}
                  onChange={(ids) => {
                    setProfAmounts((prev) => {
                      const next: Record<string, number> = {};
                      for (const id of ids) {
                        next[id] = prev[id] ?? 0;
                      }
                      return next;
                    });
                  }}
                  placeholder="Selecione as profissionais..."
                />
              </div>

              {Object.keys(profAmounts).length > 0 && (
                <div className="space-y-2">
                  {Object.keys(profAmounts).map((profId) => {
                    const prof = professionals.find((p) => p.id === profId);
                    return (
                      <div key={profId} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm">{prof?.name ?? profId}</span>
                        <CurrencyInput
                          value={profAmounts[profId] ?? 0}
                          onChange={(val) => setProfAmounts((prev) => ({ ...prev, [profId]: val }))}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setProfAmounts((prev) => {
                              const next = { ...prev };
                              delete next[profId];
                              return next;
                            })
                          }
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-muted-foreground text-xs">
                    Total: {formatCurrency(totalAmount)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <FormField
              control={form.control}
              name="total_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Total</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value ?? 0} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
                          {n} parcelas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Intervalo</FormLabel>
              <Select
                value={isCustomInterval ? "custom" : String(installmentInterval ?? "")}
                onValueChange={handleIntervalChange}
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
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          </div>

          {/* Fixed interval: first_due_date + pre-calculated remaining dates */}
          {!isCustomInterval && (
            <div className="space-y-2">
              <FormLabel>Datas de vencimento</FormLabel>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-muted-foreground text-sm">Parcela 1</span>
                  <FormField
                    control={form.control}
                    name="first_due_date"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <DatePicker
                            selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                            onChange={(date) =>
                              field.onChange(date ? date.toISOString().slice(0, 10) : "")
                            }
                            placeholderText="Selecione a data"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="w-24 shrink-0 text-right text-sm">
                    {formatCurrency(installmentAmounts[0] ?? 0)}
                  </span>
                </div>

                {previewDates.map((date, i) => (
                  <div key={date || `preview-${i + 2}`} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-muted-foreground text-sm">
                      Parcela {i + 2}
                    </span>
                    <div className="relative flex-1">
                      <DatePicker
                        selected={date ? new Date(`${date}T00:00:00`) : null}
                        onChange={() => undefined}
                        disabled
                      />
                      <button
                        type="button"
                        onClick={() => switchToCustom()}
                        className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
                        title="Editar datas manualmente"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm">
                      {formatCurrency(installmentAmounts[i + 1] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom interval: all dates editable */}
          {isCustomInterval && (
            <div className="space-y-2">
              <FormLabel>Datas de vencimento</FormLabel>
              <div className="space-y-2">
                {Array.from({ length: installmentCount }, (_, i) => (
                  <div key={`custom-date-${i + 1}`} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-muted-foreground text-sm">
                      Parcela {i + 1}
                    </span>
                    <FormField
                      control={form.control}
                      name={`installments_dates.${i}`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <DatePicker
                              selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                              onChange={(date) =>
                                field.onChange(date ? date.toISOString().slice(0, 10) : "")
                              }
                              placeholderText="Selecione a data"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="w-24 shrink-0 text-right text-sm">
                      {formatCurrency(installmentAmounts[i] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notas sobre a cobrança" rows={3} {...field} />
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
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
