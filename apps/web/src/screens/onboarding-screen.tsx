"use client";

import { joinEnterpriseAction } from "@/actions/join-enterprise-action";
import { requestEnterpriseAction } from "@/actions/request-enterprise-action";
import { setProfessionalTypeAction } from "@/actions/set-professional-type-action";
import { setUserTypeAction } from "@/actions/set-user-type-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Tables } from "@nascere/supabase/types";
import { InputMask } from "@react-input/mask";
import { Baby, Building2, ClipboardList, Heart, LockKeyhole, Stethoscope } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState } from "react";
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
    description: "Obstetra, enfermeiro ou doula",
    icon: Stethoscope,
  },
  {
    type: "manager",
    label: "Gestor",
    description: "Gerenciamento da organização",
    icon: Building2,
  },
  {
    type: "secretary",
    label: "Secretário(a)",
    description: "Suporte administrativo",
    icon: ClipboardList,
  },
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
    description: "Médico especializado em gestação e parto",
    icon: Stethoscope,
  },
  {
    type: "enfermeiro",
    label: "Enfermeiro(a)",
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
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: "",
    legal_name: "",
    cnpj: "",
    email: "",
    phone: "",
    whatsapp: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipcode: "",
    professionals_amount: 5,
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

  function handleRequestEnterprise(e: React.FormEvent) {
    e.preventDefault();
    // set userType
    if (!selectedRole || selectedRole !== "manager") return;
    executeUserType({ type: selectedRole });
    executeRequestEnterprise({
      ...enterpriseForm,
      professionals_amount: Number(enterpriseForm.professionals_amount),
    });
  }

  function updateEnterpriseField(field: keyof typeof enterpriseForm, value: string | number) {
    setEnterpriseForm((prev) => ({ ...prev, [field]: value }));
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
    <div className="flex h-full flex-col items-center justify-center px-4 py-8">
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
        <form onSubmit={handleRequestEnterprise} className="flex w-full max-w-sm flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="font-medium text-xs">
              Nome da organização *
            </label>
            <Input
              id="name"
              value={enterpriseForm.name}
              onChange={(e) => updateEnterpriseField("name", e.target.value)}
              placeholder="Ex: Clínica Nascere"
              disabled={isPending}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="legal_name" className="font-medium text-xs">
              Razão social
            </label>
            <Input
              id="legal_name"
              value={enterpriseForm.legal_name}
              onChange={(e) => updateEnterpriseField("legal_name", e.target.value)}
              placeholder="Ex: Clínica Nascere Ltda"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="cnpj" className="font-medium text-xs">
              CNPJ
            </label>
            <InputMask
              id="cnpj"
              component={Input}
              placeholder="99.999.999/9999-99"
              mask="__.___.___/____-__"
              replacement={{ _: /\d/ }}
              value={enterpriseForm.cnpj}
              onChange={(e) => updateEnterpriseField("cnpj", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="font-medium text-xs">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                value={enterpriseForm.email}
                onChange={(e) => updateEnterpriseField("email", e.target.value)}
                placeholder="contato@minhaorganizacao.com"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="font-medium text-xs">
                Telefone
              </label>
              <InputMask
                id="phone"
                component={Input}
                placeholder="(99) 99999-9999"
                mask="(__) _____-____"
                replacement={{ _: /\d/ }}
                value={enterpriseForm.phone}
                onChange={(e) => updateEnterpriseField("phone", e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="whatsapp" className="font-medium text-xs">
              WhatsApp
            </label>
            <InputMask
              id="whatsapp"
              component={Input}
              placeholder="(99) 99999-9999"
              mask="(__) _____-____"
              replacement={{ _: /\d/ }}
              value={enterpriseForm.whatsapp}
              onChange={(e) => updateEnterpriseField("whatsapp", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="street" className="font-medium text-xs">
                Endereço
              </label>
              <Input
                id="street"
                value={enterpriseForm.street}
                onChange={(e) => updateEnterpriseField("street", e.target.value)}
                placeholder="Rua / Avenida"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="number" className="font-medium text-xs">
                Número
              </label>
              <Input
                id="number"
                value={enterpriseForm.number}
                onChange={(e) => updateEnterpriseField("number", e.target.value)}
                placeholder="123"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="complement" className="font-medium text-xs">
                Complemento
              </label>
              <Input
                id="complement"
                value={enterpriseForm.complement}
                onChange={(e) => updateEnterpriseField("complement", e.target.value)}
                placeholder="Sala 10"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="neighborhood" className="font-medium text-xs">
                Bairro
              </label>
              <Input
                id="neighborhood"
                value={enterpriseForm.neighborhood}
                onChange={(e) => updateEnterpriseField("neighborhood", e.target.value)}
                placeholder="Centro"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="city" className="font-medium text-xs">
                Cidade
              </label>
              <Input
                id="city"
                value={enterpriseForm.city}
                onChange={(e) => updateEnterpriseField("city", e.target.value)}
                placeholder="São Paulo"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="state" className="font-medium text-xs">
                UF
              </label>
              <Input
                id="state"
                value={enterpriseForm.state}
                onChange={(e) => updateEnterpriseField("state", e.target.value)}
                placeholder="SP"
                maxLength={2}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="zipcode" className="font-medium text-xs">
              CEP
            </label>
            <InputMask
              id="zipcode"
              component={Input}
              mask="_____-___"
              replacement={{ _: /\d/ }}
              value={enterpriseForm.zipcode}
              placeholder="00000-000"
              onChange={(e) => updateEnterpriseField("zipcode", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="professionals_amount" className="font-medium text-xs">
              Número de profissionais
            </label>
            <select
              id="professionals_amount"
              value={enterpriseForm.professionals_amount}
              onChange={(e) =>
                updateEnterpriseField("professionals_amount", Number(e.target.value))
              }
              disabled={isPending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {PROFESSIONALS_AMOUNT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending || !enterpriseForm.name}
            className="mt-1 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Enviando..." : "Solicitar criação"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoinEnterprise} className="flex w-full max-w-xs flex-col gap-4">
          <div className="flex justify-center gap-3">
            {tokenDigits.map((digit, index) => (
              <input
                // biome-ignore lint/suspicious/noArrayIndexKey: order is fixed
                key={index}
                ref={(el) => {
                  tokenInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="text"
                maxLength={1}
                value={digit}
                autoFocus={index === 0}
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
