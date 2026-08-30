"use client";

import { completePatientRegistrationAction } from "@/actions/complete-patient-registration-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { PartnerFormFields, type PartnerFormValues } from "@/components/shared/partner-form-fields";
import { ESTADOS_BR } from "@/lib/constants";
import { MARITAL_STATUS_OPTIONS } from "@/lib/validations/patient";
import {
  type LinkExistingPatientRegistrationInput,
  type PatientSelfRegistrationInput,
  linkExistingPatientRegistrationSchema,
  patientSelfRegistrationSchema,
} from "@/lib/validations/patient-invite";
// import { useAuth } from "@/providers/auth-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import { supabase } from "@ventre/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import dayjs from "dayjs";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { type Control, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Invite = {
  id: string;
  invite_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type LinkedPatient = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

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

const step1Schema = z
  .object({
    email: z.string().email("Digite um e-mail válido"),
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type Step1Values = z.infer<typeof step1Schema>;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StepIndicator({ current, isNewPatient }: { current: Step; isNewPatient: boolean }) {
  const steps = isNewPatient
    ? [
        { n: 1, label: "Email e senha" },
        { n: 2, label: "Meus dados" },
        { n: 3, label: "Parceria" },
        { n: 4, label: "Contato" },
        { n: 5, label: "Endereço" },
        { n: 6, label: "Confirmação" },
      ]
    : [
        { n: 1, label: "Email e senha" },
        { n: 2, label: "Seus dados" },
        { n: 3, label: "Confirmação" },
      ];

  return (
    <div className="mb-10 flex items-center justify-center">
      {steps.map(({ n, label }, i) => {
        const done = current > n;
        const active = current === n;
        return (
          <Fragment key={n}>
            <div className="relative">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm transition-colors ${
                  done
                    ? "bg-primary text-white"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border-2 border-muted-foreground/30 text-muted-foreground/50"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={`-translate-x-1/2 absolute top-9 left-1/2 whitespace-nowrap text-xs ${
                  active ? "font-medium text-primary" : "text-muted-foreground/60"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-20 transition-colors ${done ? "bg-primary" : "bg-muted-foreground/20"}`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

export default function PatientRegisterScreen({
  invite,
  linkedPatient,
}: {
  invite: Invite;
  linkedPatient: LinkedPatient | null;
}) {
  const router = useRouter();
  // const { signInWithGoogle } = useAuth();
  const isNewPatient = invite.invite_type === "new_patient";

  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState("");
  const [dataValues, setDataValues] = useState<
    PatientSelfRegistrationInput | LinkExistingPatientRegistrationInput | null
  >(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [addressVisible, setAddressVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [dueDateCalcMethod, setDueDateCalcMethod] = useState<DueDateCalcMethod | undefined>(
    undefined,
  );
  const [gestAgeWeeks, setGestAgeWeeks] = useState("");
  const [gestAgeDays, setGestAgeDays] = useState("");
  const [fivTransferDate, setFivTransferDate] = useState("");
  const [fivTransferType, setFivTransferType] = useState<FivTransferType>("D5");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      email: invite.email ?? linkedPatient?.email ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  const selfRegForm = useForm<PatientSelfRegistrationInput>({
    // Cast the schema (not the resolver) to short-circuit zodResolver's structural
    // inference over this many nested optional fields, which otherwise hits TS's
    // "type instantiation is excessively deep" limit.
    resolver: zodResolver(
      patientSelfRegistrationSchema as unknown as z.ZodType<PatientSelfRegistrationInput>,
    ),
    defaultValues: {
      password: "",
      name: invite.name ?? "",
      email: invite.email ?? "",
      phone: invite.phone ?? "",
      partner_name: "",
      baby_name: "",
      due_date: "",
      dum: "",
      observations: "",
      partner: {},
      address: {
        street: "",
        neighborhood: "",
        complement: "",
        number: "",
        city: "",
        state: "",
        zipcode: "",
      },
    },
  });

  const linkForm = useForm<LinkExistingPatientRegistrationInput>({
    resolver: zodResolver(linkExistingPatientRegistrationSchema),
    defaultValues: {
      password: "",
      name: linkedPatient?.name ?? "",
      email: linkedPatient?.email ?? "",
      phone: linkedPatient?.phone ?? "",
    },
  });

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) selfRegForm.setValue("address.street", data.street);
      if (data.neighborhood) selfRegForm.setValue("address.neighborhood", data.neighborhood);
      if (data.city) selfRegForm.setValue("address.city", data.city);
      if (data.state) selfRegForm.setValue("address.state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { executeAsync } = useAction(completePatientRegistrationAction);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  function resetDueDateFields() {
    selfRegForm.setValue("dum", "");
    selfRegForm.setValue("due_date", "");
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
    selfRegForm.setValue("dum", dum.format("YYYY-MM-DD"));
    selfRegForm.setValue("due_date", dum.add(280, "day").format("YYYY-MM-DD"));
  }

  function applyDum(date: Date | null) {
    if (!date) {
      resetDueDateFields();
      return;
    }
    const dumStr = date.toISOString().slice(0, 10);
    selfRegForm.setValue("dum", dumStr);
    selfRegForm.setValue("due_date", dayjs(dumStr).add(280, "day").format("YYYY-MM-DD"));
  }

  function applyDpp(date: Date | null) {
    if (!date) {
      resetDueDateFields();
      return;
    }
    const dppStr = date.toISOString().slice(0, 10);
    selfRegForm.setValue("due_date", dppStr);
    selfRegForm.setValue("dum", dayjs(dppStr).subtract(280, "day").format("YYYY-MM-DD"));
  }

  function applyFiv(transferDateStr: string, type: FivTransferType) {
    setFivTransferDate(transferDateStr);
    setFivTransferType(type);
    if (!transferDateStr) {
      resetDueDateFields();
      return;
    }
    const dpp = dayjs(transferDateStr).add(FIV_DPP_OFFSET_DAYS[type], "day");
    selfRegForm.setValue("due_date", dpp.format("YYYY-MM-DD"));
    selfRegForm.setValue("dum", dpp.subtract(280, "day").format("YYYY-MM-DD"));
  }

  const SELF_REG_STEP_FIELDS: Partial<Record<Step, (keyof PatientSelfRegistrationInput)[]>> = {
    2: ["name"],
    4: ["phone"],
  };

  async function goToNextSelfReg() {
    if (step === 2 && !dueDateCalcMethod) {
      toast.error("Selecione o método de cálculo da DUM/DPP");
      return;
    }

    if (step === 5) {
      const valid = await selfRegForm.trigger();
      if (!valid) return;
      setDataValues(selfRegForm.getValues());
      setStep(6);
      return;
    }

    const fields = SELF_REG_STEP_FIELDS[step];
    if (fields && fields.length > 0) {
      const valid = await selfRegForm.trigger(fields);
      if (!valid) return;
    }
    setStep((prev) => Math.min(prev + 1, 5) as Step);
  }

  function goToPrevSelfReg() {
    setStep((prev) => Math.max(prev - 1, 1) as Step);
  }

  // async function handleGoogleSignup() {
  //   const { error } = await signInWithGoogle("/patient-registration/complete", {
  //     name: "patient_invite",
  //     piid: invite.id,
  //   });
  //   if (error) toast.error("Erro ao conectar com o Google");
  // }

  async function handleFinish() {
    if (!dataValues) return;
    setIsFinishing(true);
    try {
      const isSelfReg = isNewPatient;
      const selfRegValues = isSelfReg ? (dataValues as PatientSelfRegistrationInput) : null;
      const linkValues = !isSelfReg ? (dataValues as LinkExistingPatientRegistrationInput) : null;

      const finalEmail = isSelfReg
        ? (selfRegValues?.email ?? invite.email ?? "")
        : (linkValues?.email ?? invite.email ?? "");
      const finalPhone = isSelfReg ? selfRegValues?.phone : linkValues?.phone;
      const finalName = isSelfReg ? selfRegValues?.name : linkValues?.name;

      const result = await executeAsync({
        inviteId: invite.id,
        password,
        name: finalName,
        email: finalEmail || undefined,
        phone: finalPhone,
        partner_name: selfRegValues?.partner_name,
        rg: selfRegValues?.rg,
        cpf: selfRegValues?.cpf,
        marital_status: selfRegValues?.marital_status,
        occupation: selfRegValues?.occupation,
        due_date: selfRegValues?.due_date,
        dum: selfRegValues?.dum,
        baby_name: selfRegValues?.baby_name,
        observations: selfRegValues?.observations,
        partner: selfRegValues?.partner,
        address: selfRegValues?.address,
      });

      if (!result?.data?.email) {
        toast.error(result?.serverError ?? "Erro ao criar conta.");
        return;
      }

      // Upload the avatar via the account's inviteId (not the browser session): email
      // confirmation may be required, in which case signInWithPassword below fails and
      // there is no session yet to authenticate a normal /api/profile/avatar upload with.
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        formData.append("inviteId", invite.id);
        const avatarRes = await fetch("/api/patient-registration/avatar", {
          method: "POST",
          body: formData,
        });
        if (!avatarRes.ok) {
          const avatarData = await avatarRes.json().catch(() => null);
          toast.error(
            avatarData?.error ??
              "Não foi possível salvar a foto de perfil. Tente novamente depois em seu perfil.",
          );
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password,
      });

      if (signInError) {
        router.push(`/patient-registration/complete?piid=${invite.id}`);
        return;
      }

      // Hard navigation: router.push('/home') → server redirect('/onboarding') race
      // where getServerAuth() doesn't see the fresh session yet. Full reload avoids this
      // (same fix already applied in app/(auth)/login/page.tsx).
      window.location.href = "/home";
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsFinishing(false);
    }
  }

  const displayName = isNewPatient
    ? selfRegForm.watch("name") || invite.name || ""
    : linkForm.watch("name") || linkedPatient?.name || invite.name || "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFAF5] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="https://ventre.app/logo.png"
            alt="Ventre"
            width={120}
            className="mx-auto mb-6 object-contain"
          />
          <h1 className="font-bold text-2xl text-[#433831]">Crie sua conta</h1>
          <p className="mt-1 text-[#81726C] text-sm">
            Acompanhe seu pré-natal, agenda e financeiro em um só lugar
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <StepIndicator current={step} isNewPatient={isNewPatient} />

          {/* ── Step 1: Email e senha ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Form {...step1Form}>
                <form
                  onSubmit={step1Form.handleSubmit((values) => {
                    setPassword(values.password);
                    selfRegForm.setValue("email", values.email);
                    selfRegForm.setValue("password", values.password);
                    linkForm.setValue("email", values.email);
                    linkForm.setValue("password", values.password);
                    setStep(2);
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step1Form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Crie uma senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step1Form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirme a senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Repita a senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="gradient-primary mt-2 w-full">
                    Próximo
                  </Button>
                </form>
              </Form>

              {/* <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-muted-foreground text-xs">OU</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignup}
              >
                <CustomIcon icon="google" className="mr-2 h-4 w-4" />
                Continuar com Google
              </Button> */}
            </div>
          )}

          {/* ── Steps 2-5: Meus dados / Parceria / Contato / Endereço ── */}
          {(step === 2 || step === 3 || step === 4 || step === 5) && isNewPatient && (
            <Form {...selfRegForm}>
              <form
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="space-y-4"
              >
                {/* ── Step 2: Meus dados ── */}
                {step === 2 && (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative"
                      >
                        <Avatar className="h-20 w-20 shadow-md">
                          <AvatarImage
                            src={avatarPreviewUrl ?? undefined}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 text-lg text-primary">
                            {getInitials(displayName || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="h-5 w-5 text-white" />
                        </div>
                      </button>
                      <p className="text-muted-foreground text-xs">
                        Clique para adicionar uma foto
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>

                    <FormField
                      control={selfRegForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome completo *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={selfRegForm.control}
                      name="partner_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da parceria</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={selfRegForm.control}
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
                        control={selfRegForm.control}
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
                        control={selfRegForm.control}
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
                        control={selfRegForm.control}
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

                    <FormField
                      control={selfRegForm.control}
                      name="baby_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do bebê</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel>Calculo da Idade Gestacional *</FormLabel>
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
                                applyFiv(
                                  date ? date.toISOString().slice(0, 10) : "",
                                  fivTransferType,
                                )
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
                          control={selfRegForm.control}
                          name="dum"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Última menstruação (DUM) *</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
                                  onChange={applyDum}
                                  placeholderText="Selecione a data"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={selfRegForm.control}
                          name="due_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data prevista do parto (DPP)</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
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
                          control={selfRegForm.control}
                          name="due_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data prevista do parto (DPP) *</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
                                  onChange={applyDpp}
                                  placeholderText="Selecione a data"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={selfRegForm.control}
                          name="dum"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Última menstruação (DUM)</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
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
                          control={selfRegForm.control}
                          name="dum"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Última menstruação (DUM)</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
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
                          control={selfRegForm.control}
                          name="due_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data prevista do parto (DPP)</FormLabel>
                              <FormControl>
                                <DatePicker
                                  selected={
                                    field.value ? new Date(`${field.value}T00:00:00`) : null
                                  }
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
                      control={selfRegForm.control}
                      name="observations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea rows={2} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* ── Step 3: Parceria ── */}
                {step === 3 && (
                  <PartnerFormFields
                    control={selfRegForm.control as unknown as Control<PartnerFormValues>}
                  />
                )}

                {/* ── Step 4: Contato ── */}
                {step === 4 && (
                  <>
                    <FormField
                      control={selfRegForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@exemplo.com"
                              {...field}
                              value={field.value ?? ""}
                              readOnly
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={selfRegForm.control}
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
                  </>
                )}

                {/* ── Step 5: Endereço ── */}
                {step === 5 && (
                  <>
                    <FormField
                      control={selfRegForm.control}
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
                                  if (digits.length === 8) lookupCep({ cep: digits });
                                  if (digits.length < 8) setAddressVisible(false);
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
                        control={selfRegForm.control}
                        name="address.street"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input disabled={!addressVisible} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={selfRegForm.control}
                        name="address.number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input disabled={!addressVisible} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        control={selfRegForm.control}
                        name="address.neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input disabled={!addressVisible} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={selfRegForm.control}
                        name="address.city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input disabled={!addressVisible} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={selfRegForm.control}
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
                                  <SelectValue placeholder="UF" />
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
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={step === 2 ? () => setStep(1) : goToPrevSelfReg}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    className="gradient-primary flex-1"
                    onClick={goToNextSelfReg}
                  >
                    Próximo
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {step === 2 && !isNewPatient && (
            <Form {...linkForm}>
              <form
                onSubmit={linkForm.handleSubmit((values) => {
                  setDataValues(values);
                  setStep(3);
                })}
                className="space-y-5"
              >
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative"
                  >
                    <Avatar className="h-20 w-20 shadow-md">
                      <AvatarImage src={avatarPreviewUrl ?? undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-lg text-primary">
                        {getInitials(displayName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </button>
                  <p className="text-muted-foreground text-xs">Clique para adicionar uma foto</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <FormField
                  control={linkForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={linkForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <InputMask
                          component={Input}
                          mask="(__) _____-____"
                          replacement={{ _: /\d/ }}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" className="gradient-primary flex-1">
                    Próximo
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* ── Confirmation ── */}
          {step === (isNewPatient ? 6 : 3) && dataValues && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-20 w-20 shadow-md">
                  <AvatarImage src={avatarPreviewUrl ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(displayName || "?")}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/30 p-4 text-sm">
                {isNewPatient ? (
                  <>
                    <DataRow
                      label="Nome"
                      value={(dataValues as PatientSelfRegistrationInput).name}
                    />
                    <DataRow
                      label="Telefone"
                      value={(dataValues as PatientSelfRegistrationInput).phone}
                    />
                    <DataRow
                      label="DPP"
                      value={(dataValues as PatientSelfRegistrationInput).due_date}
                    />
                    {(() => {
                      const address = (dataValues as PatientSelfRegistrationInput).address;
                      if (!address) return null;
                      const addressLine = [address.street, address.number, address.complement]
                        .filter(Boolean)
                        .join(", ");
                      const cityLine = [
                        address.neighborhood,
                        address.city && address.state
                          ? `${address.city}/${address.state}`
                          : address.city,
                      ]
                        .filter(Boolean)
                        .join(" — ");
                      return (
                        <>
                          {address.zipcode && <DataRow label="CEP" value={address.zipcode} />}
                          {addressLine && <DataRow label="Endereço" value={addressLine} />}
                          {cityLine && <DataRow label="Bairro/Cidade" value={cityLine} />}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <DataRow
                      label="Nome"
                      value={(dataValues as LinkExistingPatientRegistrationInput).name}
                    />
                    <DataRow
                      label="E-mail"
                      value={(dataValues as LinkExistingPatientRegistrationInput).email}
                    />
                    <DataRow
                      label="Telefone"
                      value={(dataValues as LinkExistingPatientRegistrationInput).phone}
                    />
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(isNewPatient ? 5 : 2)}
                  disabled={isFinishing}
                >
                  Voltar
                </Button>
                <Button
                  className="gradient-primary flex-1"
                  onClick={handleFinish}
                  disabled={isFinishing}
                >
                  {isFinishing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finalizando...
                    </span>
                  ) : (
                    "Finalizar cadastro"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-muted-foreground text-xs">
          © {new Date().getFullYear()} Ventre. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
