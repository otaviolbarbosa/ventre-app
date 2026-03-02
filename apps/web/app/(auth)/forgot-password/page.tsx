"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { useAuth } from "@/hooks/use-auth";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    setIsLoading(true);
    const { error } = await resetPassword(data.email);

    if (error) {
      toast.error("Erro ao enviar email", {
        description:
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Ocorreu um erro desconhecido",
      });
      setIsLoading(false);
      return;
    }

    setSentTo(data.email);
    setEmailSent(true);
    setIsLoading(false);
  }

  if (emailSent) {
    return (
      <div className="hero-animate hero-animate-1 space-y-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>

        <div>
          <h1 className="font-poppins font-semibold text-2xl text-foreground">Email enviado!</h1>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            Enviamos um link de redefinição para{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. Verifique sua caixa de
            entrada e spam.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-muted-foreground text-xs">
            O link expira em <span className="font-medium text-foreground">1 hora</span>. Se não
            receber, verifique a pasta de spam ou solicite um novo link.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="hero-animate hero-animate-1">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-poppins font-semibold text-2xl text-foreground">Esqueceu a senha?</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Digite seu email e enviaremos um link de redefinição
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-foreground/60 text-xs uppercase tracking-wide">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    className="h-11 rounded-xl border-border/60 bg-muted/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="gradient-primary h-11 w-full rounded-xl font-semibold shadow-soft"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link de redefinição
          </Button>
        </form>
      </Form>

      <Link
        href="/login"
        className="hero-animate hero-animate-3 inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o login
      </Link>
    </div>
  );
}
