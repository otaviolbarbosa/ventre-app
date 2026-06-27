"use client";
import { addPatientAction } from "@/actions/add-patient-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { CurrencyInput } from "@/components/billing/currency-input";
import {
  calculateInstallmentDates,
  formatCurrency,
  recalculateInstallmentAmounts,
} from "@/lib/billing/calculations";
import { ESTADOS_BR } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { type CreatePatientInput, createPatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { SearchableDropdown } from "@ventre/ui/shared/searchable-dropdown";
import { Textarea } from "@ventre/ui/textarea";
import dayjs from "dayjs";
import { Check, Loader2, Pencil, RotateCcw, Shield, Users, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Professional = {
  id: string;
  name?: string | null;
  professional_type?: string | null;
  avatar_url?: string | null;
};

type Enterprise = {
  id: string;
  name: string;
};

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
  fisio: "Fisioterapeuta",
};

const PROFESSIONAL_TYPE_PLURAL_LABELS: Record<string, string> = {
  obstetra: "Obstetras",
  enfermeiro: "Enfermeiras",
  doula: "Doulas",
  fisio: "Fisioterapeutas",
};

function getBackupProfessionalIds(ids: string[], options: Professional[]): string[] {
  const seenByType: Record<string, number> = {};
  const result: string[] = [];
  for (const id of ids) {
    const prof = options.find((p) => p.id === id);
    const type = prof?.professional_type ?? "__none__";
    seenByType[type] = (seenByType[type] ?? 0) + 1;
    if (seenByType[type] === 2) result.push(id);
  }
  return result;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type StepNumber = 1 | 2 | 3 | 4 | 5;

function StepIndicator({ current, step4Label }: { current: StepNumber; step4Label: string }) {
  const STEPS = [
    { n: 1 as StepNumber, label: "Gestante" },
    { n: 2 as StepNumber, label: "Contato" },
    { n: 3 as StepNumber, label: "Endereço" },
    { n: 4 as StepNumber, label: step4Label },
    { n: 5 as StepNumber, label: "Cobrança" },
  ];
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map(({ n, label }, i) => {
        const done = current > n;
        const active = current === n;
        return (
          <Fragment key={n}>
            <div className="relative">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm transition-colors",
                  done && "bg-primary text-white",
                  active && "border-2 border-primary text-primary",
                  !done &&
                    !active &&
                    "border-2 border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={cn(
                  "-translate-x-1/2 absolute top-9 left-1/2 whitespace-nowrap text-[10px]",
                  active ? "font-medium text-primary" : "text-muted-foreground/60",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-8 transition-colors",
                  done ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

type NewPatientModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
  professional?: Professional;
  professionals?: Professional[];
  enterprises?: Enterprise[];
  initialValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
};

export default function NewPatientModal({
  showModal,
  professional,
  professionals,
  enterprises,
  setShowModal,
  onSuccess,
  initialValues,
}: NewPatientModalProps) {
  const [step, setStep] = useState<StepNumber>(1);
  const [addressVisible, setAddressVisible] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [profAmounts, setProfAmounts] = useState<Record<string, number>>({});
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [lockedAmounts, setLockedAmounts] = useState<Record<number, number>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) form.setValue("address.street", data.street);
      if (data.neighborhood) form.setValue("address.neighborhood", data.neighborhood);
      if (data.city) form.setValue("address.city", data.city);
      if (data.state) form.setValue("address.state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { execute, status } = useAction(addPatientAction, {
    onSuccess: () => {
      toast.success("Paciente cadastrada com sucesso!");
      form.reset();
      setStep(1);
      setAddressVisible(false);
      setShowBilling(false);
      setProfAmounts({});
      setIsCustomInterval(false);
      onSuccess?.();
      setShowModal(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao cadastrar paciente");
    },
  });

  const professionalsOptions =
    professionals && professionals.length > 0 ? professionals : professional ? [professional] : [];

  const isSubmitting = status === "executing";
  const showProfessionalSelector = professionalsOptions.length > 0;
  const showEnterpriseSelector = enterprises !== undefined && !showProfessionalSelector;
  const step4Label = showEnterpriseSelector ? "Empresa" : "Equipe";

  const defaultProfessionalIds = professional?.id ? [professional.id] : undefined;

  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      partner_name: "",
      baby_name: "",
      due_date: "",
      dum: "",
      address: {
        street: "",
        neighborhood: "",
        complement: "",
        number: "",
        city: "",
        state: "",
        zipcode: "",
      },
      observations: "",
      professional_ids: defaultProfessionalIds,
      enterprise_id: null,
    },
  });

  const selectedProfessionalIds = form.watch("professional_ids") ?? [];
  const isSplitBilling = showProfessionalSelector && selectedProfessionalIds.length > 1;
  const splitBillingTotal = Object.values(profAmounts).reduce((a, b) => a + b, 0);

  const billingInstallmentCount = form.watch("billing.installment_count") ?? 1;
  const billingInstallmentInterval = form.watch("billing.installment_interval");
  const billingFirstDueDate = form.watch("billing.first_due_date");
  const billingTotalAmount = isSplitBilling
    ? splitBillingTotal
    : (form.watch("billing.total_amount") ?? 0);

  const installmentAmounts = useMemo(
    () => recalculateInstallmentAmounts(billingTotalAmount, billingInstallmentCount, lockedAmounts),
    [billingTotalAmount, billingInstallmentCount, lockedAmounts],
  );

  const installmentSum = installmentAmounts.reduce((a, b) => a + b, 0);
  const hasAmountMismatch = billingTotalAmount > 0 && installmentSum !== billingTotalAmount;

  const previewDates = useMemo<string[]>(() => {
    if (
      isCustomInterval ||
      !billingFirstDueDate ||
      !billingInstallmentInterval ||
      billingInstallmentCount <= 1
    ) {
      return [];
    }
    return calculateInstallmentDates(
      billingFirstDueDate,
      billingInstallmentCount,
      billingInstallmentInterval,
    ).slice(1);
  }, [isCustomInterval, billingFirstDueDate, billingInstallmentInterval, billingInstallmentCount]);

  const prevResetKeyRef = useRef({ total: billingTotalAmount, count: billingInstallmentCount });

  useEffect(() => {
    const { total, count } = prevResetKeyRef.current;
    prevResetKeyRef.current = { total: billingTotalAmount, count: billingInstallmentCount };
    if (total !== billingTotalAmount || count !== billingInstallmentCount) {
      setLockedAmounts({});
    }
  }, [billingTotalAmount, billingInstallmentCount]);

  function handleInstallmentAmountChange(index: number, value: number) {
    setLockedAmounts((prev) => ({ ...prev, [index]: value }));
  }

  function showInstallmentAmountError(index: number) {
    return (
      billingTotalAmount > 0 &&
      (installmentAmounts[index] ?? 0) <= 0 &&
      (submitAttempted || lockedAmounts[index] === 0)
    );
  }

  // Keep profAmounts in sync with the selected professionals
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional sync
  useEffect(() => {
    if (!showBilling || !isSplitBilling) return;
    setProfAmounts((prev) => {
      const next: Record<string, number> = {};
      for (const id of selectedProfessionalIds) {
        next[id] = prev[id] ?? 0;
      }
      return next;
    });
  }, [JSON.stringify(selectedProfessionalIds), showBilling, isSplitBilling]);

  // Clear total_amount when split billing is active (Zod rejects 0 as non-positive)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional sync
  useEffect(() => {
    if (!showBilling) return;
    if (isSplitBilling) {
      form.setValue("billing.total_amount", undefined as unknown as number);
    } else {
      const current = form.getValues("billing.total_amount");
      if (!current) form.setValue("billing.total_amount", 0);
    }
  }, [isSplitBilling, showBilling]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: form is stable
  useEffect(() => {
    if (!showModal || !initialValues) return;
    if (initialValues.name) form.setValue("name", initialValues.name);
    if (initialValues.email) form.setValue("email", initialValues.email);
    if (initialValues.phone) form.setValue("phone", initialValues.phone);
  }, [showModal, initialValues?.name, initialValues?.email, initialValues?.phone]);

  // Adjust installments_dates length when count changes in custom mode
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (!isCustomInterval) return;
    const current = form.getValues("billing.installments_dates") ?? [];
    const next = Array.from({ length: billingInstallmentCount }, (_, i) => current[i] ?? "");
    form.setValue("billing.installments_dates", next);
  }, [billingInstallmentCount, isCustomInterval]);

  function switchToCustom(seedDates?: string[]) {
    const first = form.getValues("billing.first_due_date") ?? "";
    const interval = form.getValues("billing.installment_interval") ?? 1;
    const count = form.getValues("billing.installment_count") ?? 1;
    const dates =
      seedDates ??
      (first
        ? calculateInstallmentDates(first, count, interval as number)
        : Array.from({ length: count }, () => ""));
    setIsCustomInterval(true);
    form.setValue("billing.installment_interval", null);
    form.setValue("billing.first_due_date", null);
    form.setValue("billing.installments_dates", dates);
  }

  function handleBillingIntervalChange(value: string) {
    if (value === "custom") {
      switchToCustom();
    } else {
      setIsCustomInterval(false);
      form.setValue("billing.installment_interval", Number(value));
      form.setValue("billing.installments_dates", []);
    }
  }

  function toggleBilling(enabled: boolean) {
    setShowBilling(enabled);
    setProfAmounts({});
    setLockedAmounts({});
    setSubmitAttempted(false);
    setIsCustomInterval(false);
    if (enabled) {
      form.setValue("billing", {
        description: "",
        total_amount: 0,
        payment_method: undefined as unknown,
        installment_count: 1,
        installment_interval: 1,
        first_due_date: new Date().toISOString().split("T")[0],
        installments_dates: [],
        notes: "",
      } as CreatePatientInput["billing"]);
    } else {
      form.setValue("billing", undefined as CreatePatientInput["billing"]);
    }
  }

  const STEP_FIELDS: Partial<Record<StepNumber, (keyof CreatePatientInput)[]>> = {
    1: ["name", "due_date", "dum"],
    2: ["phone"],
    4: showProfessionalSelector ? ["professional_ids"] : [],
  };

  async function goToNext() {
    const fields = STEP_FIELDS[step];
    if (fields && fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setIsNavigating(true);
    setStep((prev) => Math.min(prev + 1, 5) as StepNumber);
    setTimeout(() => setIsNavigating(false), 400);
  }

  function goToPrev() {
    setStep((prev) => Math.max(prev - 1, 1) as StepNumber);
  }

  function onSubmit(data: CreatePatientInput) {
    const backupProfessionalIds = getBackupProfessionalIds(
      data.professional_ids ?? [],
      professionalsOptions,
    );

    if (showBilling && data.billing) {
      setSubmitAttempted(true);

      const hasEmptyInstallments = billingTotalAmount > 0 && installmentAmounts.some((a) => a <= 0);
      if (hasEmptyInstallments) {
        toast.error("Informe o valor de todas as parcelas.");
        return;
      }

      if (hasAmountMismatch) {
        toast.error(
          `A soma das parcelas (${formatCurrency(installmentSum)}) não corresponde ao valor total (${formatCurrency(billingTotalAmount)}).`,
        );
        return;
      }
    }

    if (showBilling && isSplitBilling && data.billing) {
      if (Object.keys(profAmounts).length === 0) {
        toast.error("Informe os valores para cada profissional.");
        return;
      }
      if (Object.values(profAmounts).some((v) => v <= 0)) {
        toast.error("Todos os valores das profissionais devem ser maiores que zero.");
        return;
      }
      execute({
        ...data,
        backup_professional_ids: backupProfessionalIds,
        billing: {
          ...data.billing,
          total_amount: undefined,
          splitted_billing: profAmounts,
          installment_interval: isCustomInterval ? null : data.billing.installment_interval,
          first_due_date: isCustomInterval ? null : data.billing.first_due_date,
          installment_amounts: installmentAmounts,
        },
      });
      return;
    }
    if (showBilling && data.billing) {
      execute({
        ...data,
        backup_professional_ids: backupProfessionalIds,
        billing: {
          ...data.billing,
          installment_interval: isCustomInterval ? null : data.billing.installment_interval,
          first_due_date: isCustomInterval ? null : data.billing.first_due_date,
          installment_amounts: installmentAmounts,
        },
      });
      return;
    }
    execute({ ...data, backup_professional_ids: backupProfessionalIds });
  }

  function resetModal() {
    form.reset();
    setStep(1);
    setAddressVisible(false);
    setShowBilling(false);
    setProfAmounts({});
    setLockedAmounts({});
    setSubmitAttempted(false);
    setIsCustomInterval(false);
    setIsNavigating(false);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={(open) => {
        if (!open) resetModal();
        setShowModal(open);
      }}
      title="Nova Gestante"
      description=""
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && step < 5) e.preventDefault();
          }}
          className="space-y-6"
        >
          <StepIndicator current={step} step4Label={step4Label} />

          <div className="min-h-[400px]">
            {/* ── Step 1: Dados da Gestante ── */}
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da paciente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do parceiro</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome do parceiro"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="baby_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do bebê</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome escolhido para o bebê"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data prevista do parto (DPP) *</FormLabel>
                        <FormControl>
                          <DatePicker
                            selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                            onChange={(date) => {
                              field.onChange(date ? date.toISOString().slice(0, 10) : "");
                              if (date) {
                                form.setValue(
                                  "dum",
                                  dayjs(date).subtract(280, "day").format("YYYY-MM-DD"),
                                );
                              } else {
                                form.setValue("dum", "");
                              }
                            }}
                            placeholderText="Selecione a data"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Última menstruação (DUM)</FormLabel>
                        <FormControl>
                          <DatePicker
                            selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                            onChange={(date) =>
                              field.onChange(date ? date.toISOString().slice(0, 10) : "")
                            }
                            placeholderText="Calculado automaticamente"
                            disabled
                            className="bg-muted"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais sobre a paciente"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Step 2: Contato ── */}
            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <InputMask
                          component={Input}
                          placeholder="(99) 99999-9999"
                          mask="(__) _____-____"
                          replacement={{ _: /\d/ }}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Step 3: Endereço ── */}
            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="address.zipcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <InputMask
                            component={Input}
                            mask="_____-___"
                            replacement={{ _: /\d/ }}
                            placeholder="00000-000"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const digits = e.target.value.replace(/\D/g, "");
                              if (digits.length === 8) {
                                lookupCep({ cep: digits });
                              }
                              if (digits.length < 8) {
                                setAddressVisible(false);
                              }
                            }}
                          />
                          {isFetchingCep && (
                            <div className="absolute inset-y-0 right-3 flex items-center">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="address.city"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-3">
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select
                          value={field.value ?? undefined}
                          onValueChange={field.onChange}
                          disabled={!addressVisible}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESTADOS_BR.map((estado) => (
                              <SelectItem key={estado.sigla} value={estado.sigla}>
                                {estado.sigla}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-3">
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Rua das Flores"
                            disabled={!addressVisible}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address.number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="address.complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto 45" disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address.neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro" disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Equipe / Empresa ── */}
            {step === 4 && (
              <div className="space-y-4">
                {showProfessionalSelector ? (
                  <FormField
                    control={form.control}
                    name="professional_ids"
                    render={({ field, fieldState }) => {
                      const selectedIds: string[] = field.value ?? [];
                      const hasError = !!fieldState.error && selectedIds.length === 0;
                      const selectedProfessionals = selectedIds
                        .map((id) => professionalsOptions.find((p) => p.id === id))
                        .filter(Boolean) as Professional[];
                      const backupIds = getBackupProfessionalIds(selectedIds, professionalsOptions);

                      function removeProfessional(id: string) {
                        field.onChange((field.value ?? []).filter((x) => x !== id));
                      }

                      function makeResponsible(id: string) {
                        const current = field.value ?? [];
                        if (current[0] === id) return;
                        field.onChange([id, ...current.filter((x) => x !== id)]);
                      }

                      return (
                        <FormItem>
                          <FormLabel>Profissionais responsáveis</FormLabel>

                          <FormControl>
                            <SearchableDropdown
                              multiple
                              options={professionalsOptions.map((prof) => ({
                                value: prof.id,
                                label: prof.professional_type
                                  ? `${prof.name ?? "—"} — ${
                                      PROFESSIONAL_TYPE_LABELS[prof.professional_type] ??
                                      prof.professional_type
                                    }`
                                  : (prof.name ?? "—"),
                                group: prof.professional_type
                                  ? PROFESSIONAL_TYPE_PLURAL_LABELS[prof.professional_type]
                                  : undefined,
                              }))}
                              value={selectedIds}
                              onChange={(next) => field.onChange(next)}
                              placeholder="Selecione as profissionais"
                              searchPlaceholder="Buscar profissional..."
                              emptyMessage="Nenhuma profissional encontrada"
                              maxSelectedPerGroup={2}
                              className={cn(
                                selectedIds.length > 0 && "border-primary/40",
                                hasError && "border-destructive",
                              )}
                            />
                          </FormControl>

                          {selectedProfessionals.length > 0 && (
                            <div className="flex flex-col gap-2 pt-1">
                              {selectedProfessionals.map((prof, index) => {
                                const isResponsible = index === 0;
                                const isBackup = backupIds.includes(prof.id);
                                return (
                                  <div
                                    key={prof.id}
                                    className={cn(
                                      "flex items-center gap-1 rounded-xl border transition-colors",
                                      isResponsible
                                        ? "border-primary/30 bg-primary/5"
                                        : "border-border bg-muted/30 hover:border-primary/30 hover:bg-primary/5",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => makeResponsible(prof.id)}
                                      disabled={isResponsible}
                                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left disabled:cursor-default"
                                    >
                                      <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                                        <AvatarImage
                                          src={prof.avatar_url ?? undefined}
                                          alt={prof.name ?? ""}
                                          className="rounded-full object-cover"
                                        />
                                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                          {getInitials(prof.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="truncate font-medium text-sm">
                                            {prof.name ?? "—"}
                                          </p>
                                          {isResponsible ? (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-primary/40 bg-primary/10 px-1.5 py-0 text-primary text-xs"
                                            >
                                              <Shield className="mr-1 h-3 w-3" />
                                              Responsável
                                            </Badge>
                                          ) : (
                                            <span className="shrink-0 text-muted-foreground text-xs">
                                              Clique para tornar responsável
                                            </span>
                                          )}
                                          {isBackup && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-muted-foreground/30 bg-muted px-1.5 py-0 text-muted-foreground text-xs"
                                            >
                                              Backup
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                          {prof.professional_type
                                            ? (PROFESSIONAL_TYPE_LABELS[prof.professional_type] ??
                                              prof.professional_type)
                                            : "Profissional"}
                                        </p>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeProfessional(prof.id)}
                                      className="mr-2 rounded-full p-1 hover:bg-muted"
                                    >
                                      <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                ) : showEnterpriseSelector ? (
                  <FormField
                    control={form.control}
                    name="enterprise_id"
                    render={({ field }) => {
                      const enterpriseOptions = [
                        {
                          id: null as string | null,
                          name: "Atendimento Autônomo",
                          description: "Sem vínculo com empresa",
                        },
                        ...(enterprises ?? []).map((e) => ({
                          id: e.id as string | null,
                          name: e.name,
                          description: null,
                        })),
                      ];
                      return (
                        <FormItem>
                          <FormLabel>Vincular ao atendimento</FormLabel>
                          <div className="flex flex-col gap-2 pt-1">
                            {enterpriseOptions.map((opt) => {
                              const isSelected = field.value === opt.id;
                              return (
                                <button
                                  key={opt.id ?? "autonomous"}
                                  type="button"
                                  onClick={() => field.onChange(opt.id)}
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                                    isSelected
                                      ? "border-primary/40 bg-primary/5"
                                      : "border-border hover:border-primary/30 hover:bg-muted/40",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                      isSelected ? "bg-primary/20" : "bg-muted",
                                    )}
                                  >
                                    {opt.id === null ? (
                                      <Users
                                        className={cn(
                                          "h-4 w-4",
                                          isSelected ? "text-primary" : "text-muted-foreground",
                                        )}
                                      />
                                    ) : (
                                      <Shield
                                        className={cn(
                                          "h-4 w-4",
                                          isSelected ? "text-primary" : "text-muted-foreground",
                                        )}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={cn(
                                        "font-medium text-sm",
                                        isSelected && "text-primary",
                                      )}
                                    >
                                      {opt.name}
                                    </p>
                                    {opt.description && (
                                      <p className="text-muted-foreground text-xs">
                                        {opt.description}
                                      </p>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check className="h-4 w-4 shrink-0 text-primary" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                ) : null}
              </div>
            )}

            {/* ── Step 5: Cobrança ── */}
            {step === 5 && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleBilling(!showBilling)}
                  className="flex w-full items-center gap-2 rounded-md border border-dashed p-3 text-muted-foreground text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="font-medium">
                    {showBilling
                      ? "− Remover dados de pagamento"
                      : "+ Adicionar dados de pagamento"}
                  </span>
                </button>

                {showBilling && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="billing.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Acompanhamento pré-natal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isSplitBilling ? (
                      <div className="space-y-2">
                        <FormLabel>Profissionais e Valores *</FormLabel>
                        {Object.keys(profAmounts).map((profId) => {
                          const prof = professionalsOptions.find((p) => p.id === profId);
                          return (
                            <div key={profId} className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage
                                  src={prof?.avatar_url ?? undefined}
                                  alt={prof?.name ?? ""}
                                  className="rounded-full object-cover"
                                />
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                  {getInitials(prof?.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {prof?.name ?? profId}
                              </span>
                              <CurrencyInput
                                value={profAmounts[profId] ?? 0}
                                onChange={(val) =>
                                  setProfAmounts((prev) => ({ ...prev, [profId]: val }))
                                }
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
                        {selectedProfessionalIds.some((id) => !(id in profAmounts)) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {selectedProfessionalIds
                              .filter((id) => !(id in profAmounts))
                              .map((profId) => {
                                const prof = professionalsOptions.find((p) => p.id === profId);
                                return (
                                  <button
                                    key={profId}
                                    type="button"
                                    onClick={() =>
                                      setProfAmounts((prev) => ({ ...prev, [profId]: 0 }))
                                    }
                                    className="flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-primary hover:text-primary"
                                  >
                                    + {prof?.name ?? profId}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        {splitBillingTotal > 0 && (
                          <p className="text-right text-muted-foreground text-xs">
                            Total: {formatCurrency(splitBillingTotal)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="billing.total_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor Total *</FormLabel>
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
                      name="billing.payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método de Pagamento *</FormLabel>
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
                        name="billing.installment_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parcelas *</FormLabel>
                            <Select
                              value={String(field.value ?? 1)}
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

                      <FormItem>
                        <FormLabel>Intervalo *</FormLabel>
                        <Select
                          value={
                            isCustomInterval ? "custom" : String(billingInstallmentInterval ?? "")
                          }
                          onValueChange={handleBillingIntervalChange}
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

                    {!isCustomInterval && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <FormLabel>Datas de vencimento</FormLabel>
                          {Object.keys(lockedAmounts).length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setLockedAmounts({})}
                              className="h-6 gap-1 px-2 text-muted-foreground text-xs"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reiniciar parcelas
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="w-20 shrink-0 pt-2 text-muted-foreground text-xs">
                              Parcela 1
                            </span>
                            <FormField
                              control={form.control}
                              name="billing.first_due_date"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <DatePicker
                                      selected={
                                        field.value ? new Date(`${field.value}T00:00:00`) : null
                                      }
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
                            <div className="w-28 shrink-0">
                              <CurrencyInput
                                value={installmentAmounts[0] ?? 0}
                                onChange={(val) => handleInstallmentAmountChange(0, val)}
                              />
                              {showInstallmentAmountError(0) && (
                                <p className="mt-0.5 text-destructive text-xs">Campo obrigatório</p>
                              )}
                            </div>
                          </div>

                          {previewDates.map((date, i) => (
                            <div
                              key={date || `preview-${i + 2}`}
                              className="flex items-start gap-3"
                            >
                              <span className="w-20 shrink-0 pt-2 text-muted-foreground text-xs">
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
                              <div className="w-28 shrink-0">
                                <CurrencyInput
                                  value={installmentAmounts[i + 1] ?? 0}
                                  onChange={(val) => handleInstallmentAmountChange(i + 1, val)}
                                />
                                {showInstallmentAmountError(i + 1) && (
                                  <p className="mt-0.5 text-destructive text-xs">
                                    Campo obrigatório
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {hasAmountMismatch && (
                          <p className="text-destructive text-xs">
                            A soma das parcelas ({formatCurrency(installmentSum)}) não corresponde
                            ao valor total ({formatCurrency(billingTotalAmount)}).
                          </p>
                        )}
                      </div>
                    )}

                    {isCustomInterval && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <FormLabel>Datas de vencimento</FormLabel>
                          {Object.keys(lockedAmounts).length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setLockedAmounts({})}
                              className="h-6 gap-1 px-2 text-muted-foreground text-xs"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reiniciar parcelas
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: billingInstallmentCount }, (_, i) => (
                            <div key={`custom-date-${i + 1}`} className="flex items-start gap-3">
                              <span className="w-20 shrink-0 pt-2 text-muted-foreground text-xs">
                                Parcela {i + 1}
                              </span>
                              <FormField
                                control={form.control}
                                name={
                                  `billing.installments_dates.${i}` as "billing.installments_dates"
                                }
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <DatePicker
                                        selected={
                                          field.value ? new Date(`${field.value}T00:00:00`) : null
                                        }
                                        onChange={(date) =>
                                          field.onChange(
                                            date ? date.toISOString().slice(0, 10) : "",
                                          )
                                        }
                                        placeholderText="Selecione a data"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="w-28 shrink-0">
                                <CurrencyInput
                                  value={installmentAmounts[i] ?? 0}
                                  onChange={(val) => handleInstallmentAmountChange(i, val)}
                                />
                                {showInstallmentAmountError(i) && (
                                  <p className="mt-0.5 text-destructive text-xs">
                                    Campo obrigatório
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {hasAmountMismatch && (
                          <p className="text-destructive text-xs">
                            A soma das parcelas ({formatCurrency(installmentSum)}) não corresponde
                            ao valor total ({formatCurrency(billingTotalAmount)}).
                          </p>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="billing.notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações da cobrança</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Notas sobre a cobrança" rows={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Navigation ── */}
          <div className="flex gap-2 pt-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={goToPrev}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            )}

            {step < 5 ? (
              <Button
                type="button"
                className="gradient-primary flex-1"
                onClick={goToNext}
                disabled={isSubmitting}
              >
                Próximo
              </Button>
            ) : (
              <Button
                type="submit"
                className="gradient-primary flex-1"
                disabled={isSubmitting || isNavigating}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar Paciente
              </Button>
            )}
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
