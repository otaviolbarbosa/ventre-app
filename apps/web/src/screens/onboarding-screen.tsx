"use client";

import { joinEnterpriseAction } from "@/actions/join-enterprise-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { requestEnterpriseAction } from "@/actions/request-enterprise-action";
import { setProfessionalTypeAction } from "@/actions/set-professional-type-action";
import { setUserTypeAction } from "@/actions/set-user-type-action";
import { ESTADOS_BR } from "@/lib/constants";
import { type RequestEnterpriseInput, requestEnterpriseSchema } from "@/lib/validations/enterprise";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Card } from "@ventre/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Baby, Building2, Heart, Loader2, LockKeyhole, Stethoscope } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type UserRoleType = Tables<"users">["user_type"];
type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;

const PROFESSIONALS_AMOUNT_OPTIONS = [
  { label: "Até 5 profissionais", value: 5 },
  { label: "Até 10 profissionais", value: 10 },
  { label: "Até 20 profissionais", value: 20 },
  { label: "Até 30 profissionais", value: 30 },
  { label: "Mais de 30 profissionais", value: 999 },
];

const userRoles: {
  type: UserRoleType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "professional",
    label: "Profissional",
    description: "Obstetra, enfermeira ou doula",
    icon: Stethoscope,
  },
  {
    type: "manager",
    label: "Empresa",
    description: "Gerenciamento de múltiplas profissionais",
    icon: Building2,
  },
  // {
  //   type: "secretary",
  //   label: "Secretário(a)",
  //   description: "Suporte administrativo",
  //   icon: ClipboardList,
  // },
];

const professionalTypes: {
  type: ProfessionalType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "obstetra",
    label: "Obstetra",
    description: "Médica especializada em gestação e parto",
    icon: Stethoscope,
  },
  {
    type: "enfermeiro",
    label: "Enfermeira",
    description: "Profissional de enfermagem obstétrica",
    icon: Heart,
  },
  {
    type: "doula",
    label: "Doula",
    description: "Suporte contínuo durante a gestação e parto",
    icon: Baby,
  },
];

export default function OnboardingScreen() {
  const [selectedRole, setSelectedRole] = useState<UserRoleType | null>(null);
  const [tokenDigits, setTokenDigits] = useState<string[]>(Array(5).fill(""));
  const tokenInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const token = tokenDigits.join("");

  // Create new enterprise state
  const [createNewEnterprise, setCreateNewEnterprise] = useState(false);
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [addressVisible, setAddressVisible] = useState(false);

  const enterpriseForm = useForm<RequestEnterpriseInput>({
    resolver: zodResolver(requestEnterpriseSchema),
    defaultValues: {
      name: "",
      legal_name: "",
      cnpj: "",
      email: "",
      phone: "",
      whatsapp: "",
      zipcode: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      professionals_amount: 5,
    },
  });

  const { execute: executeProfessionalType, status: professionalTypeStatus } =
    useAction(setProfessionalTypeAction);

  const { execute: executeUserType, status: userTypeStatus } = useAction(setUserTypeAction);

  const { execute: executeJoinEnterprise, status: joinEnterpriseStatus } = useAction(
    joinEnterpriseAction,
    {
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Erro ao entrar na organização.");
      },
    },
  );

  const { execute: executeRequestEnterprise, status: requestEnterpriseStatus } = useAction(
    requestEnterpriseAction,
    {
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Erro ao solicitar criação da organização.");
      },
    },
  );

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) enterpriseForm.setValue("street", data.street);
      if (data.neighborhood) enterpriseForm.setValue("neighborhood", data.neighborhood);
      if (data.city) enterpriseForm.setValue("city", data.city);
      if (data.state) enterpriseForm.setValue("state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado");
    },
  });

  const isFetchingCep = cepStatus === "executing";

  useEffect(() => {
    if (!createNewEnterprise) {
      tokenInputRefs.current[0]?.focus();
    }
  }, [createNewEnterprise]);

  const isPending =
    professionalTypeStatus === "executing" ||
    userTypeStatus === "executing" ||
    joinEnterpriseStatus === "executing" ||
    requestEnterpriseStatus === "executing";

  function handleRoleSelect(role: UserRoleType) {
    setSelectedRole(role);
  }

  function handleProfessionalTypeSelect(type: ProfessionalType) {
    executeProfessionalType({ type });
  }

  function handleTokenChange(index: number, value: string) {
    const char = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(-1);
    const next = [...tokenDigits];
    next[index] = char;
    setTokenDigits(next);
    if (char && index < 4) {
      tokenInputRefs.current[index + 1]?.focus();
    }
  }

  function handleTokenKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (tokenDigits[index]) {
        const next = [...tokenDigits];
        next[index] = "";
        setTokenDigits(next);
      } else if (index > 0) {
        tokenInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      tokenInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 4) {
      tokenInputRefs.current[index + 1]?.focus();
    }
  }

  function handleTokenPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 5);
    const next = Array(5).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setTokenDigits(next);
    const focusIndex = Math.min(pasted.length, 4);
    tokenInputRefs.current[focusIndex]?.focus();
  }

  function handleJoinEnterprise(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole || !["manager", "secreatry"].includes(selectedRole)) return;
    executeJoinEnterprise({ token, userType: selectedRole });
  }

  function handleRequestEnterprise(data: RequestEnterpriseInput) {
    if (!selectedRole || selectedRole !== "manager") return;
    executeUserType({ type: selectedRole });
    executeRequestEnterprise(data);
  }

  function handleWhatsappSameAsPhone(checked: boolean) {
    setWhatsappSameAsPhone(checked);
    if (checked) {
      enterpriseForm.setValue("whatsapp", enterpriseForm.getValues("phone"));
    } else {
      enterpriseForm.setValue("whatsapp", "");
    }
  }

  if (!selectedRole) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="mb-8 text-center">
          <h1 className="font-poppins font-semibold text-2xl tracking-tight">
            Qual é o seu perfil?
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Selecione o perfil para personalizar sua experiência
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {userRoles.map(({ type, label, description, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleRoleSelect(type)}
              className="group"
            >
              <Card className="flex h-44 w-44 cursor-pointer flex-col items-center justify-center gap-3 p-4 transition-colors group-hover:bg-muted/50">
                <Icon className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="mt-1 text-muted-foreground text-xs">{description}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedRole === "professional") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="mb-8 text-center">
          <h1 className="font-poppins font-semibold text-2xl tracking-tight">
            Qual é a sua especialidade?
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Selecione sua área de atuação para personalizar sua experiência
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {professionalTypes.map(({ type, label, description, icon: Icon }) => (
            <button
              key={type}
              type="button"
              disabled={isPending}
              onClick={() => handleProfessionalTypeSelect(type)}
              className="group"
            >
              <Card className="flex h-44 w-44 cursor-pointer flex-col items-center justify-center gap-3 p-4 transition-colors group-hover:bg-muted/50 group-disabled:cursor-not-allowed group-disabled:opacity-50">
                <Icon className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="mt-1 text-muted-foreground text-xs">{description}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSelectedRole(null)}
          className="mt-6 text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-start px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="font-poppins font-semibold text-2xl tracking-tight">
          {createNewEnterprise
            ? "Solicitar criação de organização"
            : "Insira o token da organização"}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {createNewEnterprise
            ? "Preencha os dados da organização para enviar a solicitação"
            : "Digite o código de 5 dígitos fornecido pela sua organização"}
        </p>
      </div>

      {selectedRole === "manager" && (
        <label className="mb-6 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={createNewEnterprise}
            onChange={(e) => setCreateNewEnterprise(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Criar um novo perfil organizacional</span>
        </label>
      )}

      {createNewEnterprise ? (
        <Form {...enterpriseForm}>
          <form
            onSubmit={enterpriseForm.handleSubmit(handleRequestEnterprise)}
            className="flex w-full max-w-sm flex-col gap-3"
          >
            <FormField
              control={enterpriseForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da organização *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Clínica Ventre" disabled={isPending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={enterpriseForm.control}
              name="legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão social</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Clínica Ventre Ltda" disabled={isPending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={enterpriseForm.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <InputMask
                      component={Input}
                      placeholder="99.999.999/9999-99"
                      mask="__.___.___/____-__"
                      replacement={{ _: /\d/ }}
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={enterpriseForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contato@minhaorganizacao.com"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={enterpriseForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <InputMask
                        component={Input}
                        placeholder="(99) 99999-9999"
                        mask="(__) _____-____"
                        replacement={{ _: /\d/ }}
                        disabled={isPending}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (whatsappSameAsPhone) {
                            enterpriseForm.setValue("whatsapp", e.target.value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={enterpriseForm.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className={whatsappSameAsPhone ? "sr-only" : ""}>WhatsApp</FormLabel>
                    <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
                      <input
                        type="checkbox"
                        checked={whatsappSameAsPhone}
                        onChange={(e) => handleWhatsappSameAsPhone(e.target.checked)}
                        disabled={isPending}
                        className="accent-primary"
                      />
                      Este número é WhatsApp
                    </label>
                  </div>
                  {!whatsappSameAsPhone && (
                    <FormControl>
                      <InputMask
                        component={Input}
                        placeholder="(99) 99999-9999"
                        mask="(__) _____-____"
                        replacement={{ _: /\d/ }}
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={enterpriseForm.control}
              name="zipcode"
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
                        disabled={isPending}
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

            {addressVisible && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <FormField
                    control={enterpriseForm.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua / Avenida" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={enterpriseForm.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem className="col-span-1">
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={enterpriseForm.control}
                    name="complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Sala 10" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={enterpriseForm.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={enterpriseForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={enterpriseForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem className="col-span-1">
                        <FormLabel>UF</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
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

            <FormField
              control={enterpriseForm.control}
              name="professionals_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de profissionais</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROFESSIONALS_AMOUNT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button size="xl" className="mt-4" disabled={isPending}>
              {isPending ? "Enviando..." : "Solicitar criação"}
            </Button>
          </form>
        </Form>
      ) : (
        <form onSubmit={handleJoinEnterprise} className="flex w-full max-w-xs flex-col gap-4">
          <div className="flex justify-center gap-3">
            {tokenDigits.map((digit, index) => (
              <input
                // biome-ignore lint/suspicious/noArrayIndexKey: order is fixed
                key={`enterprise-token-${index}`}
                ref={(el) => {
                  tokenInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="text"
                maxLength={1}
                value={digit}
                disabled={isPending}
                onChange={(e) => handleTokenChange(index, e.target.value)}
                onKeyDown={(e) => handleTokenKeyDown(index, e)}
                onPaste={handleTokenPaste}
                onFocus={(e) => e.target.select()}
                className="h-14 w-12 rounded-xl border-2 border-input bg-background text-center font-mono font-semibold text-xl transition-colors focus:border-primary focus:outline-none disabled:opacity-50"
              />
            ))}
          </div>
          <Button size="lg" disabled={isPending || token.length !== 5}>
            {isPending ? "Entrando..." : "Entrar na organização"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setSelectedRole(null)}
        className="mt-6 text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        Voltar
      </button>
    </div>
  );
}
