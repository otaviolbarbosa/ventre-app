"use client";

import { completeRegistrationAction } from "@/actions/complete-registration-action";
import { professionalTypeLabels } from "@/utils/team";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@ventre/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Invite = {
  id: string;
  name: string;
  email: string;
  phone: string;
  professional_type: string;
  enterprises: { name: string } | null;
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

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(1, "Telefone é obrigatório"),
});

type ProfileValues = z.infer<typeof profileSchema>;

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

export default function CompleteRegistrationScreen({ invite }: { invite: Invite }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [password, setPassword] = useState("");
  const [profileData, setProfileData] = useState<ProfileValues>({
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileData,
  });

  const { executeAsync } = useAction(completeRegistrationAction);

  const enterpriseName = invite.enterprises?.name ?? "Sua clínica";
  const typeLabel = professionalTypeLabels[invite.professional_type] ?? invite.professional_type;

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  async function handleFinish() {
    setIsFinishing(true);
    try {
      // 1. Create the account via server action
      const result = await executeAsync({
        inviteId: invite.id,
        password,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
      });

      if (!result?.data?.email) {
        toast.error(result?.serverError ?? "Erro ao criar conta.");
        return;
      }

      // 2. Sign in with the browser client to establish a session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password,
      });

      if (signInError) {
        // Account was created — redirect to login
        router.push("/login?confirmation=registration_complete");
        return;
      }

      // 3. If an avatar was selected, upload it now that a session exists
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
          <h1 className="font-bold text-2xl text-[#433831]">Finalize seu cadastro</h1>
          <p className="mt-1 text-[#81726C] text-sm">
            Você foi convidada por <strong>{enterpriseName}</strong>
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <StepIndicator current={step} />

          {/* ── Step 1: Password ── */}
          {step === 1 && (
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
          )}

          {/* ── Step 2: Confirm data + avatar ── */}
          {step === 2 && (
            <Form {...profileForm}>
              <form
                onSubmit={profileForm.handleSubmit((values) => {
                  setProfileData(values);
                  setStep(3);
                })}
                className="space-y-5"
              >
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative"
                  >
                    <Avatar className="h-20 w-20 shadow-md">
                      <AvatarImage src={avatarPreviewUrl ?? undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-lg text-primary">
                        {getInitials(profileForm.watch("name") || invite.name)}
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

                {/* Editable fields */}
                <div className="space-y-3">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Read-only fields */}
                <div className="space-y-3 rounded-xl bg-muted/30 p-4 text-sm">
                  <DataRow label="Especialidade" value={typeLabel} />
                  <DataRow label="Clínica" value={enterpriseName} />
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
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-20 w-20 shadow-md">
                  <AvatarImage src={avatarPreviewUrl ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(profileData.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/30 p-4 text-sm">
                <DataRow label="Nome" value={profileData.name} />
                <DataRow label="E-mail" value={profileData.email} />
                <DataRow label="Telefone" value={profileData.phone} />
                <DataRow label="Especialidade" value={typeLabel} />
                <DataRow label="Clínica" value={enterpriseName} />
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

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
