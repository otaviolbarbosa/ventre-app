"use client";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { updatePatientAction } from "@/actions/update-patient-action";
import { ESTADOS_BR } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  MARITAL_STATUS_OPTIONS,
  type UpdatePatientInput,
  updatePatientSchema,
} from "@/lib/validations/patient";
import type { PatientAddress } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import dayjs from "dayjs";
import { Check, Loader2 } from "lucide-react";

import { useAction } from "next-safe-action/hooks";
import type React from "react";
import { Fragment, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type PatientWithPrenatalDates = Tables<"patients"> & {
  due_date?: string | null;
  dum?: string | null;
  observations?: string | null;
  address?: PatientAddress | null;
};

type EditPatientModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientWithPrenatalDates;
  onSuccess: () => Promise<void>;
};

type DueDateCalcMethod = "gestational_age" | "dum" | "dpp" | "fiv";
type FivTransferType = "D0" | "D3" | "D5" | "D6" | "D7";

const FIV_TRANSFER_OPTIONS: { value: FivTransferType; label: string }[] = [
  { value: "D0", label: "D0 — transferência no dia da coleta" },
  { value: "D3", label: "D3 — transferência 3 dias após a coleta" },
  { value: "D5", label: "D5 — transferência 5 dias após a coleta" },
  { value: "D6", label: "D6 — transferência 6 dias após a coleta" },
  { value: "D7", label: "D7 — transferência 7 dias após a coleta" },
];

// Dias somados à data de transferência para chegar na DPP (280 dias de gestação - idade do embrião na transferência)
const FIV_DPP_OFFSET_DAYS: Record<FivTransferType, number> = {
  D0: 266,
  D3: 263,
  D5: 261,
  D6: 260,
  D7: 259,
};

type StepNumber = 1 | 2 | 3;

const STEPS: { n: StepNumber; label: string }[] = [
  { n: 1, label: "Dados Pessoais" },
  { n: 2, label: "Contatos" },
  { n: 3, label: "Endereço" },
];

function StepIndicator({ current }: { current: StepNumber }) {
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

function hasAddress(patient: PatientWithPrenatalDates) {
  const addr = patient.address;
  return !!(addr?.zipcode || addr?.street || addr?.city);
}

export function EditPatientModal({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: EditPatientModalProps) {
  const [step, setStep] = useState<StepNumber>(1);
  const [addressVisible, setAddressVisible] = useState(false);
  const [dueDateCalcMethod, setDueDateCalcMethod] = useState<DueDateCalcMethod | undefined>(
    undefined,
  );
  const [gestAgeWeeks, setGestAgeWeeks] = useState("");
  const [gestAgeDays, setGestAgeDays] = useState("");
  const [fivTransferDate, setFivTransferDate] = useState("");
  const [fivTransferType, setFivTransferType] = useState<FivTransferType>("D5");

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
      toast.error("CEP não encontrado. Preencha o endereço manualmente.");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { executeAsync, isPending: isSaving } = useAction(updatePatientAction);

  const form = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      partner_name: "",
      rg: "",
      cpf: "",
      marital_status: undefined,
      occupation: "",
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
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when patient or open changes
  useEffect(() => {
    if (open) {
      const addr = patient.address;
      form.reset({
        name: patient.name,
        email: patient.email ?? undefined,
        phone: patient.phone,
        partner_name: patient.partner_name || "",
        rg: patient.rg || "",
        cpf: patient.cpf || "",
        marital_status: (patient.marital_status ??
          undefined) as UpdatePatientInput["marital_status"],
        occupation: patient.occupation || "",
        due_date: patient.due_date ?? undefined,
        dum: patient.dum || "",
        address: {
          street: addr?.street || "",
          neighborhood: addr?.neighborhood || "",
          complement: addr?.complement || "",
          number: addr?.number || "",
          city: addr?.city || "",
          state: addr?.state || "",
          zipcode: addr?.zipcode || "",
        },
        observations: patient.observations || "",
      });
      setAddressVisible(hasAddress(patient));
      setStep(1);
      setDueDateCalcMethod(patient.dum || patient.due_date ? "dum" : undefined);
      setGestAgeWeeks("");
      setGestAgeDays("");
      setFivTransferDate("");
      setFivTransferType("D5");
    }
  }, [open, patient]);

  function resetDueDateFields() {
    form.setValue("dum", "");
    form.setValue("due_date", "");
  }

  function handleCalcMethodChange(method: DueDateCalcMethod) {
    setDueDateCalcMethod(method);
    setGestAgeWeeks("");
    setGestAgeDays("");
    setFivTransferDate("");
    setFivTransferType("D5");
    resetDueDateFields();
  }

  function applyGestAge(weeksStr: string, daysStr: string) {
    setGestAgeWeeks(weeksStr);
    setGestAgeDays(daysStr);
    const weeks = Number(weeksStr);
    const days = Number(daysStr);
    if (weeksStr === "" || daysStr === "" || Number.isNaN(weeks) || Number.isNaN(days)) {
      resetDueDateFields();
      return;
    }
    const dum = dayjs().subtract(weeks * 7 + days, "day");
    form.setValue("dum", dum.format("YYYY-MM-DD"));
    form.setValue("due_date", dum.add(280, "day").format("YYYY-MM-DD"));
  }

  function applyDum(date: Date | null) {
    if (!date) {
      resetDueDateFields();
      return;
    }
    const dumStr = date.toISOString().slice(0, 10);
    form.setValue("dum", dumStr);
    form.setValue("due_date", dayjs(dumStr).add(280, "day").format("YYYY-MM-DD"));
  }

  function applyDpp(date: Date | null) {
    if (!date) {
      resetDueDateFields();
      return;
    }
    const dppStr = date.toISOString().slice(0, 10);
    form.setValue("due_date", dppStr);
    form.setValue("dum", dayjs(dppStr).subtract(280, "day").format("YYYY-MM-DD"));
  }

  function applyFiv(transferDateStr: string, type: FivTransferType) {
    setFivTransferDate(transferDateStr);
    setFivTransferType(type);
    if (!transferDateStr) {
      resetDueDateFields();
      return;
    }
    const dpp = dayjs(transferDateStr).add(FIV_DPP_OFFSET_DAYS[type], "day");
    form.setValue("due_date", dpp.format("YYYY-MM-DD"));
    form.setValue("dum", dpp.subtract(280, "day").format("YYYY-MM-DD"));
  }

  async function onSubmit(data: UpdatePatientInput) {
    const result = await executeAsync({ patientId: patient.id, data });

    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }

    await onSuccess();
    onOpenChange(false);
    toast.success("Gestante atualizada com sucesso!");
  }

  const STEP_FIELDS: Partial<Record<StepNumber, (keyof UpdatePatientInput)[]>> = {
    1: ["name", "due_date", "dum"],
    2: ["phone"],
  };

  async function goToNext(e: React.FormEvent) {
    e.preventDefault();

    if (step === 1 && !dueDateCalcMethod) {
      toast.error("Selecione o método de cálculo da DUM/DPP");
      return;
    }
    const fields = STEP_FIELDS[step];
    if (fields && fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((prev) => Math.min(prev + 1, 3) as StepNumber);
  }

  function goToPrev() {
    setStep((prev) => Math.max(prev - 1, 1) as StepNumber);
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Paciente"
      description="Atualize os dados da gestante"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && step < 3) e.preventDefault();
          }}
          className="space-y-4"
        >
          <StepIndicator current={step} />

          <div className="min-h-[360px]">
            {/* ── Step 1: Dados Pessoais ── */}
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <InputMask
                            component={Input}
                            mask="___.___.___-__"
                            replacement={{ _: /\d/ }}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="marital_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado civil</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MARITAL_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profissão</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Cálculo da Idade Gestacional *</FormLabel>
                  <Select
                    value={dueDateCalcMethod}
                    onValueChange={(v) => handleCalcMethodChange(v as DueDateCalcMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método de cálculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestational_age">Idade gestacional</SelectItem>
                      <SelectItem value="dum">Data da última menstruação (DUM)</SelectItem>
                      <SelectItem value="dpp">Data prevista do parto (DPP)</SelectItem>
                      <SelectItem value="fiv">FIV/FET (transferência de embrião)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dueDateCalcMethod === "gestational_age" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormItem>
                      <FormLabel>Semanas *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={45}
                          placeholder="Ex: 20"
                          value={gestAgeWeeks}
                          onChange={(e) => applyGestAge(e.target.value, gestAgeDays)}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel>Dias *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={6}
                          placeholder="Ex: 3"
                          value={gestAgeDays}
                          onChange={(e) => applyGestAge(gestAgeWeeks, e.target.value)}
                        />
                      </FormControl>
                    </FormItem>
                  </div>
                )}

                {dueDateCalcMethod === "fiv" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormItem>
                      <FormLabel>Data da transferência *</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={
                            fivTransferDate ? new Date(`${fivTransferDate}T00:00:00`) : null
                          }
                          onChange={(date) =>
                            applyFiv(date ? date.toISOString().slice(0, 10) : "", fivTransferType)
                          }
                          placeholderText="Selecione a data"
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel>Tipo de transferência *</FormLabel>
                      <Select
                        value={fivTransferType}
                        onValueChange={(v) => applyFiv(fivTransferDate, v as FivTransferType)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FIV_TRANSFER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  </div>
                )}

                {dueDateCalcMethod === "dum" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Última menstruação (DUM) *</FormLabel>
                          <FormControl>
                            <DatePicker
                              selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                              onChange={applyDum}
                              placeholderText="Selecione a data"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data prevista do parto (DPP)</FormLabel>
                          <FormControl>
                            <DatePicker
                              selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                              onChange={() => undefined}
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
                )}

                {dueDateCalcMethod === "dpp" && (
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
                              onChange={applyDpp}
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
                              onChange={() => undefined}
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
                )}

                {(dueDateCalcMethod === "gestational_age" || dueDateCalcMethod === "fiv") && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Última menstruação (DUM)</FormLabel>
                          <FormControl>
                            <DatePicker
                              selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                              onChange={() => undefined}
                              placeholderText="Calculado automaticamente"
                              disabled
                              className="bg-muted"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data prevista do parto (DPP)</FormLabel>
                          <FormControl>
                            <DatePicker
                              selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                              onChange={() => undefined}
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
                )}

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Step 2: Contatos ── */}
            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value ?? ""} />
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
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <InputMask
                          component={Input}
                          mask="(__) _____-____"
                          replacement={{ _: /\d/ }}
                          {...field}
                          value={field.value ?? ""}
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
                            value={field.value ?? ""}
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

                {addressVisible && (
                  <>
                    {/* Rua (3 cols) | Número (1 col) */}
                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="address.street"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Rua das Flores"
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
                        name="address.number"
                        render={({ field }) => (
                          <FormItem className="col-span-1">
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="123" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Complemento (2 cols) | Bairro (2 cols) */}
                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="address.complement"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input placeholder="Apto 45" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.neighborhood"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input placeholder="Centro" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Cidade (2 cols) | UF (1 col) */}
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="São Paulo" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.state"
                        render={({ field }) => (
                          <FormItem className="col-span-1">
                            <FormLabel>UF</FormLabel>
                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="UF" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ESTADOS_BR.map((estado) => (
                                  <SelectItem key={estado.sigla} value={estado.sigla}>
                                    {estado.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={goToPrev} disabled={isSaving}>
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            )}

            {step < 3 ? (
              <Button type="button" className="gradient-primary" onClick={goToNext}>
                Próximo
              </Button>
            ) : (
              <Button type="submit" className="gradient-primary" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            )}
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
