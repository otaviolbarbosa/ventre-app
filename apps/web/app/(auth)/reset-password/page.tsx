"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import { translateAuthError } from "@/lib/auth-error-messages";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(data: ResetPasswordFormData) {
    setIsLoading(true);
    const { error } = await updatePassword(data.password);

    if (error) {
      toast.error("Erro ao redefinir senha", {
        description: translateAuthError(
          error,
          "O link pode ter expirado. Solicite um novo link de redefinição.",
        ),
      });
      setIsLoading(false);
      return;
    }

    toast.success("Senha redefinida com sucesso!");
    // The session behind this page came from the recovery email link — proxy.ts keeps
    // it confined to /reset-password via the "recovery" amr claim, and updateUser()
    // above doesn't clear that claim from the current session's token. Sign out instead
    // of continuing into the app, so access always requires the freshly-set password.
    await signOut("/login?passwordReset=success");
  }

  async function handleCancel() {
    setIsCancelling(true);
    // proxy.ts confines a recovery session to this page — signing out is the only way
    // out, otherwise the user can never reach /login, /register or the landing page again.
    await signOut("/login");
  }

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="hero-animate hero-animate-1">
        <h1 className="font-poppins font-semibold text-2xl text-foreground">
          Defina sua nova senha
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Escolha uma nova senha para acessar sua conta
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="hero-animate hero-animate-2 space-y-4"
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-foreground/60 text-xs uppercase tracking-wide">
                  Nova senha
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-border/60 bg-muted/30 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((p) => !p)}
                      className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-foreground/60 text-xs uppercase tracking-wide">
                  Confirmar senha
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-border/60 bg-muted/30 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((p) => !p)}
                      className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading || isCancelling}
            className="gradient-primary h-11 w-full rounded-xl font-semibold shadow-soft"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redefinir senha
          </Button>
        </form>
      </Form>

      <button
        type="button"
        onClick={handleCancel}
        disabled={isLoading || isCancelling}
        className="hero-animate hero-animate-3 inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {isCancelling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowLeft className="h-4 w-4" />
        )}
        Cancelar e voltar para o login
      </button>
    </div>
  );
}
