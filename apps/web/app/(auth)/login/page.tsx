"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
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
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/home";
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (searchParams.get("confirmation") === "success") {
      toast.success("Cadastro confirmado com sucesso!", {
        description: "Agora você já pode fazer login.",
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("confirmation");
      const newUrl = params.size > 0 ? `?${params.toString()}` : window.location.pathname;
      router.replace(newUrl);
    }
  }, []);

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);

    if (error) {
      let message = "";
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        message = (error as { message: string }).message;
      }
      toast.error("Erro ao fazer login", {
        description:
          message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : message || "Ocorreu um erro ao fazer login.",
      });
      setIsLoading(false);
      return;
    }

    form.reset();
    router.push(redirectTo);
  }

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="hero-animate hero-animate-1">
        <h1 className="font-poppins font-semibold text-2xl text-foreground">
          Boas-vindas de volta!
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">Acesse sua conta para continuar</p>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="font-medium text-foreground/60 text-xs uppercase tracking-wide">
                    Senha
                  </FormLabel>
                  <Link href="/forgot-password" className="text-primary text-xs hover:underline">
                    Esqueceu?
                  </Link>
                </div>
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

          <Button
            type="submit"
            disabled={isLoading}
            className="gradient-primary h-11 w-full rounded-xl font-semibold shadow-soft"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="hero-animate hero-animate-3 relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-muted-foreground text-xs uppercase tracking-wide">
            ou continue com
          </span>
        </div>
      </div>

      <div className="hero-animate hero-animate-4">
        <SocialLoginButtons redirectTo={redirectTo} />
      </div>

      <p className="hero-animate hero-animate-5 text-center text-muted-foreground text-sm">
        Não tem uma conta?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Cadastre-se grátis
        </Link>
      </p>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-52 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
