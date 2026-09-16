"use client";

import Image from "next/image";
import { Button } from "@ventre/ui/button";
import Whatsapp from "@/assets/custom-icons/whatsapp";

const SUPPORT_WHATSAPP = "https://wa.me/5500000000000";

/** Brand burgundy — lê o token do design system, com fallback para o valor de código. */
const BRAND_BURGUNDY = "var(--brand-burgundy, #78130A)";

/** Entrada landingFadeUp (0.65s expo, escalonada) — keyframes declarados no componente. */
const fadeUp = (delay: number): React.CSSProperties => ({
  animation: `ventreFadeUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
});

type ErrorStateProps = {
  /** Texto grande dentro do anel: "404", "500", "OFF" */
  code: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Conteúdo extra entre o subtítulo e os botões (ex.: pill "Reconectando…") */
  slot?: React.ReactNode;
  showSupport?: boolean;
};

export function ErrorState({
  code,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  slot,
  showSupport = true,
}: ErrorStateProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      <style>{`
        @keyframes ventreArcDraw {
          from { stroke-dashoffset: 741; }
          to { stroke-dashoffset: 237; }
        }
        @keyframes ventreFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>

      <Image
        src="/bg-fingerprint2.png"
        alt=""
        fill
        priority
        aria-hidden
        className="pointer-events-none select-none object-cover opacity-5"
      />

      <Image
        src="/ventre.png"
        alt="Ventre"
        width={360}
        height={90}
        priority
        className="animate-landing-fade-up absolute top-9 h-[26px] w-auto sm:h-[30px]"
      />

      {/* Anel gestacional emoldurando o código */}
      <div
        className="relative mt-6 flex size-[190px] items-center justify-center sm:size-[260px]"
        style={fadeUp(0)}
      >
        <svg
          viewBox="0 0 260 260"
          aria-hidden
          className="absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="130"
            cy="130"
            r="118"
            fill="none"
            strokeWidth="4"
            className="stroke-primary/10"
          />
          <circle
            cx="130"
            cy="130"
            r="118"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-primary"
            style={{
              strokeDasharray: 741,
              animation:
                "ventreArcDraw 1.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both",
            }}
          />
        </svg>
        <span
          className="font-poppins select-none text-[76px] font-bold leading-none tracking-[-0.04em] opacity-[0.12] sm:text-[104px]"
          style={{ color: BRAND_BURGUNDY }}
        >
          {code}
        </span>
      </div>

      <div
        className="relative mt-6 w-full max-w-[480px] text-center"
        style={fadeUp(0.15)}
      >
        <h1 className="font-poppins mb-2.5 text-[23px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        <p className="mb-6 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {subtitle}
        </p>

        {slot}

        <div
          className="flex flex-col justify-center gap-2.5 sm:flex-row"
          style={fadeUp(0.3)}
        >
          <Button size="lg" className="gradient-primary rounded-full" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          <Button size="lg" variant="ghost" className="rounded-full" asChild>
            <a href="/">Ir para o início</a>
          </Button>
        </div>

        {showSupport ? (
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            style={fadeUp(0.3)}
          >
            <Whatsapp className="size-[15px]" />
            Falar com suporte
          </a>
        ) : null}
      </div>
    </main>
  );
}
