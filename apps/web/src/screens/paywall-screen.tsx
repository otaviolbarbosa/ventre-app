"use client";

import { createStripeCheckoutSessionAction } from "@/actions/create-stripe-checkout-session-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { supabase } from "@nascere/supabase";
import { Check, Loader2, Lock, RefreshCw, Shield, Star } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

// const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

type BillingCycle = "month" | "year";

const freeFeatures = [
  "Gerenciamento de gestantes",
  "Controle de evolução da gestante",
  "Notificações em tempo real",
  "Cartão pré-natal",
];

const premiumFeatures = [
  "Gerenciamento de consultas e encontros",
  "Participação em equipes multidisciplinares",
  "Perfil completo da gestante",
  "Ferramentas de acompanhamento (sinais vitais, contador de contrações, diário da gestante e mais)",
  "Gestão financeira",
  "Compartilhamento de documentos",
  "Gerenciamento de contratos",
  "Relatórios detalhados",
];

const enterpriseFeatures = [
  "Perfis de gestor e secretário",
  "Gerenciamento de múltiplas especialidades",
  "Gerenciamento de múltiplas agendas",
  "Relatórios qualitativos avançados",
];

export default function PaywallScreen() {
  const [billing, setBilling] = useState<BillingCycle>("month");
  const [isConfirmReplaceModalOpen, setIsConfirmReplaceModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const isAnnual = billing === "year";

  const { executeAsync: executeCreateStripeCheckoutSession } = useAction(
    createStripeCheckoutSessionAction,
  );

  const toggleBilling = () => setBilling((prev) => (prev === "month" ? "year" : "month"));

  const proceedToCheckout = async (plan: string) => {
    setIsLoadingCheckout(true);
    try {
      const {
        data: checkoutSessionUrl,
        serverError,
        validationErrors,
      } = await executeCreateStripeCheckoutSession({
        slug: `${plan}-${billing}`,
      });

      if (validationErrors) {
        toast.error(validationErrors._errors?.[0] ?? "Erro de validação nos dados de pagamento.");
        return;
      }

      if (serverError || !checkoutSessionUrl) {
        toast.error(serverError ?? "Erro na criação da sessão de pagamento.");
        return;
      }

      window.location.assign(checkoutSessionUrl);
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleSignPlan = async (plan: string) => {
    if (!user?.id) {
      router.push("/login?redirectTo=%2Fpaywall");
      return;
    }

    setIsLoadingCheckout(true);
    const { data: activeSubscription, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    setIsLoadingCheckout(false);

    if (error) {
      toast.error("Não foi possível verificar sua assinatura atual");
      return;
    }

    if (activeSubscription) {
      setPendingPlan(plan);
      setIsConfirmReplaceModalOpen(true);
      return;
    }

    await proceedToCheckout(plan);
  };

  const handleConfirmReplace = async () => {
    if (!pendingPlan) return;

    setIsConfirmReplaceModalOpen(false);
    await proceedToCheckout(pendingPlan);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="-right-32 -top-32 absolute h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="-left-48 absolute top-1/3 h-80 w-80 rounded-full bg-secondary/50 blur-3xl" />
        <div className="absolute right-1/3 bottom-0 h-64 w-64 rounded-full bg-primary/6 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="hero-animate hero-animate-1 mb-10 text-center">
          <h1 className="font-bold font-poppins text-3xl sm:text-4xl">Escolha o plano ideal</h1>
          <p className="mt-2 text-muted-foreground">
            Cuide das suas gestantes com mais carinho, organização e eficiência.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="hero-animate hero-animate-2 mb-10 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setBilling("month")}
            className={cn(
              "text-sm transition-colors",
              !isAnnual ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            Mensal
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            onClick={toggleBilling}
            className="relative h-7 w-14 cursor-pointer rounded-full bg-primary"
          >
            <div
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300",
                isAnnual ? "translate-x-8" : "translate-x-1",
              )}
            />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBilling("year")}
              className={cn(
                "text-sm transition-colors",
                isAnnual ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              Anual
            </button>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Economize ~16%</Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="hero-animate hero-animate-3 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-2">
              <p className="font-poppins font-semibold text-xl">Cuidado Básico</p>
              <p className="text-muted-foreground text-sm">Para começar</p>
            </div>
            <div className="mb-6">
              <span className="font-bold font-poppins text-4xl">R$0</span>
              <p className="mt-1 text-muted-foreground text-xs">Para sempre</p>
            </div>

            <div className="flex-1 space-y-3">
              {freeFeatures.map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Check className="h-3 w-3 text-foreground/60" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" className="mt-8 w-full">
              Plano atual
            </Button>
          </div>

          {/* Premium — gradient border */}
          <div className="relative rounded-2xl border border-primary bg-gradient-to-br from-card to-secondary/50 p-px shadow-lg">
            <div className="-top-5 -translate-x-1/2 absolute left-1/2">
              <span className="gradient-primary inline-flex items-center gap-1 rounded-full px-4 py-2 font-medium text-white shadow-md">
                <Star className="h-3 w-3" />
                Mais Popular
              </span>
            </div>

            <div className="flex h-full flex-col rounded-xl p-6">
              <div className="mb-2">
                <p className="font-poppins font-semibold text-xl">Mais Cuidado</p>
                <p className="text-muted-foreground text-sm">Para profissionais dedicados</p>
              </div>

              <div className="mb-6">
                {isAnnual ? (
                  <>
                    <span className="font-bold font-poppins text-4xl text-primary">R$299,90</span>
                    <p className="mt-1 text-muted-foreground text-xs">por ano · R$24,99/mês</p>
                    <p className="mt-0.5 font-medium text-green-600 text-xs">
                      Economize R$58,90 no ano
                    </p>
                  </>
                ) : (
                  <>
                    <span className="font-bold font-poppins text-4xl text-primary">R$29,90</span>
                    <p className="mt-1 text-muted-foreground text-xs">por mês</p>
                  </>
                )}
              </div>

              <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Tudo do gratuito, mais:
              </p>

              <div className="flex-1 space-y-2.5">
                {premiumFeatures.map((text) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{text}</span>
                  </div>
                ))}
              </div>

              <Button
                className="gradient-primary mt-8 w-full"
                onClick={() => handleSignPlan("plus-care")}
                disabled={isLoadingCheckout}
              >
                {isLoadingCheckout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assinar Mais Cuidado
              </Button>
            </div>
          </div>

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border border-primary/20 bg-card/60 p-6 shadow-sm">
            <div className="mb-2">
              <p className="font-poppins font-semibold text-xl">Cuidado Completo (Empresarial)</p>
              <p className="text-muted-foreground text-sm">Para clínicas e equipes</p>
            </div>

            <div className="mb-6">
              <span className="font-bold font-poppins text-2xl">Personalizado</span>
              <p className="mt-1 text-muted-foreground text-xs">Mediante contato com a equipe</p>
            </div>

            <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Tudo do Mais Cuidado, mais:
            </p>

            <div className="flex-1 space-y-2.5">
              {enterpriseFeatures.map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-2">
              <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/5">
                Falar com Vendas
              </Button>
              <p className="text-center text-muted-foreground text-xs">
                Nossa equipe entrará em contato
              </p>
            </div>
          </div>
        </div>

        {/* Trust columns */}
        <div className="hero-animate hero-animate-4 mt-12 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col gap-2 px-6 py-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-green-600" />
              <p className="font-medium text-sm">Pagamento 100% seguro</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Todas as transações são criptografadas com TLS. Seus dados financeiros nunca são
              armazenados em nossos servidores.
            </p>
          </div>

          <div className="flex flex-col gap-2 px-6 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-green-600" />
              <p className="font-medium text-sm">Certificado PCI DSS via Stripe</p>
            </div>
            <p className="text-muted-foreground text-xs">
              O processamento é feito pelo Stripe, líder global em pagamentos e certificado no mais
              alto nível de segurança (PCI DSS Nível 1).
            </p>
          </div>

          <div className="flex flex-col gap-2 px-6 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
              <p className="font-medium text-sm">Cancele quando quiser</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Sem multa, sem burocracia. O cancelamento pode ser solicitado a qualquer momento e
              você mantém o acesso até o fim do período pago.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={isConfirmReplaceModalOpen} onOpenChange={setIsConfirmReplaceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Você já possui assinatura ativa</DialogTitle>
            <DialogDescription>
              Já identificamos uma assinatura ativa na sua conta. Se continuar, a assinatura atual
              será substituída por uma nova.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmReplaceModalOpen(false)}
              disabled={isLoadingCheckout}
            >
              Cancelar
            </Button>
            <Button
              className="gradient-primary"
              onClick={handleConfirmReplace}
              disabled={isLoadingCheckout}
            >
              {isLoadingCheckout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
