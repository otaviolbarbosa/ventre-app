"use client";

import { completePatientRegistrationAction } from "@/actions/complete-patient-registration-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { useAuth } from "@/providers/auth-provider";
import {
  type LinkExistingPatientRegistrationInput,
  linkExistingPatientRegistrationSchema,
  type PatientSelfRegistrationInput,
  patientSelfRegistrationSchema,
} from "@/lib/validations/patient-invite";
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
import { ESTADOS_BR } from "@/lib/constants";
import dayjs from "dayjs";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import CustomIcon from "@/components/shared/custom-icon";
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

type Step = 1 | 2 | 3;

const passwordSchema = z
  .object({
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Senha" },
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
  const { signInWithGoogle } = useAuth();
  const isType1 = invite.invite_type === "new_patient";

  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState("");
  const [dataValues, setDataValues] = useState<
    PatientSelfRegistrationInput | LinkExistingPatientRegistrationInput | null
  >(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [addressVisible, setAddressVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const selfRegForm = useForm<PatientSelfRegistrationInput>({
    resolver: zodResolver(patientSelfRegistrationSchema),
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
    defaultValues: { password: "", phone: linkedPatient?.phone ?? "" },
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

  async function handleGoogleSignup() {
    const { error } = await signInWithGoogle("/patient-registration/complete", {
      name: "patient_invite",
      piid: invite.id,
    });
    if (error) toast.error("Erro ao conectar com o Google");
  }

  async function handleFinish() {
    if (!dataValues) return;
    setIsFinishing(true);
    try {
      const isSelfReg = isType1;
      const selfRegValues = isSelfReg ? (dataValues as PatientSelfRegistrationInput) : null;
      const linkValues = !isSelfReg ? (dataValues as LinkExistingPatientRegistrationInput) : null;

      const finalEmail = isSelfReg ? (selfRegValues?.email ?? invite.email ?? "") : (invite.email ?? "");
      const finalPhone = isSelfReg ? selfRegValues?.phone : linkValues?.phone;

      const result = await executeAsync({
        inviteId: invite.id,
        password,
        name: selfRegValues?.name,
        email: finalEmail || undefined,
        phone: finalPhone,
        partner_name: selfRegValues?.partner_name,
        due_date: selfRegValues?.due_date,
        dum: selfRegValues?.dum,
        baby_name: selfRegValues?.baby_name,
        observations: selfRegValues?.observations,
        address: selfRegValues?.address,
      });

      if (!result?.data?.email) {
        toast.error(result?.serverError ?? "Erro ao criar conta.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password,
      });

      if (signInError) {
        router.push("/login?confirmation=registration_complete");
        return;
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        await fetch("/api/profile/avatar", { method: "POST", body: formData });
      }

      router.push("/home");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsFinishing(false);
    }
  }

  const displayName = isType1
    ? (selfRegForm.watch("name") || invite.name || "")
    : (linkedPatient?.name ?? invite.name ?? "");

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
          <StepIndicator current={step} />

          {/* ── Step 1: Password ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit((values) => {
                    setPassword(values.password);
                    setStep(2);
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
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
                    control={passwordForm.control}
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

              <div className="flex items-center gap-3">
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
              </Button>
            </div>
          )}

          {/* ── Step 2: Dados ── */}
          {step === 2 && isType1 && (
            <Form {...selfRegForm}>
              <form
                onSubmit={selfRegForm.handleSubmit((values) => {
                  setDataValues(values);
                  setStep(3);
                })}
                className="space-y-4"
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={selfRegForm.control}
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
                                selfRegForm.setValue(
                                  "dum",
                                  dayjs(date).subtract(280, "day").format("YYYY-MM-DD"),
                                );
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
                    control={selfRegForm.control}
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

                <FormField
                  control={selfRegForm.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
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

          {step === 2 && !isType1 && (
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

                <div className="space-y-3 rounded-xl bg-muted/30 p-4 text-sm">
                  <DataRow label="Nome" value={linkedPatient?.name ?? "—"} />
                  <DataRow label="E-mail" value={linkedPatient?.email ?? "—"} />
                </div>

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

          {/* ── Step 3: Confirmation ── */}
          {step === 3 && dataValues && (
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
                {isType1 ? (
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
                  </>
                ) : (
                  <>
                    <DataRow label="Nome" value={linkedPatient?.name ?? "—"} />
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
                  onClick={() => setStep(2)}
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
