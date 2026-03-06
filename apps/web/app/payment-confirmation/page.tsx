import { CheckCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function PaymentConfirmationPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="-right-40 -top-40 absolute h-[500px] w-[500px] rounded-full bg-primary/6 blur-3xl" />
        <div className="-left-48 absolute top-1/3 h-96 w-96 rounded-full bg-secondary/60 blur-3xl" />
        <div className="-translate-x-1/2 absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-primary/4 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="hero-animate hero-animate-1 relative z-10 mb-10">
        <Image
          src="/logo.png"
          alt="Ventre — Agenda de Parto"
          width={180}
          height={64}
          priority
          className="object-contain"
        />
      </div>

      <div className="hero-animate hero-animate-2 relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
              Assinatura ativa
            </p>
            <h1 className="font-bold font-poppins text-2xl text-foreground sm:text-3xl">
              Pagamento confirmado!
            </h1>
          </div>

          {/* Divider */}
          <div className="h-px w-16 rounded-full bg-border" />

          {/* Body */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            Obrigado pela sua assinatura. Seja bem-vindo ao{" "}
            <span className="font-semibold text-primary">Ventre Premium</span> — agora você tem
            acesso completo a todas as ferramentas para cuidar das suas gestantes com ainda mais
            carinho e eficiência.
          </p>

          {/* CTA */}
          <Link
            href="/home"
            className="gradient-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-medium text-sm text-white shadow-soft transition-opacity hover:opacity-90"
          >
            Ir para o início
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <p className="hero-animate hero-animate-3 relative z-10 mt-8 text-center text-muted-foreground text-xs">
        Dúvidas? Entre em contato com nosso suporte.
      </p>
    </div>
  );
}
