// import heroBG from "@/assets/hero-bg.jpg";
import heroBG from "@/assets/hero-bg.jpg";
import { LandingFooter } from "@/components/shared/landing-footer";
import { LandingHeader } from "@/components/shared/landing-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, Baby, Calendar, CheckCircle2, Heart, Shield, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function HomePage() {
  const features = [
    {
      Icon: Baby,
      title: "Gestão de Pacientes",
      description:
        "Cadastre gestantes, acompanhe semanas gestacionais e mantenha todas as informações organizadas em um só lugar.",
    },
    {
      Icon: Calendar,
      title: "Agendamentos",
      description:
        "Organize consultas e encontros, com histórico completo de atendimentos para cada paciente.",
    },
    {
      Icon: Users,
      title: "Equipe Multidisciplinar",
      description:
        "Convide obstetras, enfermeiras e doulas para colaborar no cuidado de cada gestante.",
    },
    {
      Icon: Shield,
      title: "Dados Seguros",
      description:
        "Todas as informações das suas pacientes protegidas com os mais altos padrões de segurança e privacidade.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Crie sua conta",
      description: "Cadastre-se gratuitamente em menos de 2 minutos, sem cartão de crédito.",
    },
    {
      number: "02",
      title: "Monte sua equipe",
      description: "Convide obstetras, enfermeiras e doulas para colaborar no cuidado.",
    },
    {
      number: "03",
      title: "Cadastre pacientes",
      description: "Adicione suas gestantes e inicie o acompanhamento personalizado.",
    },
    {
      number: "04",
      title: "Acompanhe com qualidade",
      description: "Use todas as ferramentas para oferecer o melhor cuidado às suas pacientes.",
    },
  ];

  const trustItems = [
    "Sem cartão de crédito",
    "Cancele quando quiser",
    "Suporte em português",
    "Dados no Brasil",
  ];

  const stats = [
    { value: "50+", label: "Profissionais ativos" },
    { value: "300+", label: "Gestantes acompanhadas" },
    { value: "98%", label: "Satisfação dos usuários" },
    { value: "100%", label: "Seguro e privado" },
  ];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <LandingHeader />

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center pt-16">
        {/* Background image + overlays */}
        <div className="absolute inset-0 z-0 h-[560px] md:h-screen">
          <Image alt="" className="h-full w-full object-cover" src={heroBG} />
          <div className="absolute inset-0 bg-background/40 md:bg-gradient-to-r md:from-background/95 md:via-background/80 md:to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Atmospheric glow orbs */}
        <div className="absolute top-1/3 right-1/4 z-0 h-[450px] w-[450px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute right-1/3 bottom-1/4 z-0 h-[280px] w-[280px] rounded-full bg-secondary/40 blur-[70px]" />

        {/* Content */}
        <div className="container relative z-10 mx-auto px-6">
          <div className="max-w-2xl space-y-8 py-24">
            {/* Badge */}
            <div className="hero-animate hero-animate-1 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/80 px-4 py-2 font-medium text-primary-foreground text-sm">
              <Heart className="h-3.5 w-3.5 fill-current" />A melhor plataforma para o
              acompanhamento gestacional
            </div>

            {/* Headline */}
            <h1
              className="hero-animate hero-animate-2 font-bold text-foreground leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.75rem)" }}
            >
              Cuidado integrado para <span className="text-primary">gestantes</span>
            </h1>

            <p className="hero-animate hero-animate-3 max-w-lg text-foreground/60 text-lg leading-relaxed">
              Plataforma completa para profissionais de saúde acompanharem gestantes com
              organização, colaboração em equipe e comunicação eficiente.
            </p>

            {/* CTAs */}
            <div className="hero-animate hero-animate-4 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button className="gradient-primary gap-2 px-8 font-semibold shadow-soft" size="lg">
                  Começar gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button className="px-8" size="lg" variant="outline">
                  Já tenho conta
                </Button>
              </Link>
            </div>

            {/* Trust signals */}
            <div className="hero-animate hero-animate-5 flex flex-wrap gap-x-5 gap-y-2">
              {trustItems.map((item) => (
                <div className="flex items-center gap-1.5 text-foreground/50 text-sm" key={item}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute right-0 bottom-0 left-0 z-10 leading-none">
          <svg
            className="block w-full fill-background"
            viewBox="0 0 1440 60"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>divider</title>
            <path d="M0 30C360 60 1080 0 1440 30V60H0V30Z" />
          </svg>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {stats.map((stat) => (
              <div className="text-center" key={stat.label}>
                <p className="font-bold text-4xl text-primary">{stat.value}</p>
                <p className="mt-1 text-muted-foreground text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="bg-background py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 font-semibold text-primary text-sm uppercase tracking-widest">
              Funcionalidades
            </p>
            <h2 className="mx-auto max-w-xl font-bold text-3xl tracking-tight md:text-4xl">
              Tudo que você precisa para um acompanhamento de qualidade
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Ferramentas pensadas para facilitar seu dia a dia e oferecer o melhor cuidado às suas
              pacientes.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ Icon, title, description }) => (
              <div
                className="hover:-translate-y-1.5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md"
                key={title}
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how-it-works" className="bg-muted/40 py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 font-semibold text-primary text-sm uppercase tracking-widest">
              Como funciona
            </p>
            <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
              Comece em minutos, não em horas
            </h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ number, title, description }) => (
              <div
                className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm"
                key={number}
              >
                <div className="gradient-primary mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl font-bold text-lg text-white shadow-soft">
                  {number}
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28">
        <div className="gradient-cta absolute inset-0" />
        <div className="-left-32 -top-32 absolute h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="-bottom-32 -right-32 absolute h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className="container relative mx-auto px-6 text-center">
          <Heart className="mx-auto mb-6 h-10 w-10 text-white/50" />
          <h2 className="mx-auto mb-5 max-w-xl font-bold text-4xl text-white md:text-5xl">
            Comece a usar gratuitamente
          </h2>
          <p className="mx-auto mb-10 max-w-md text-lg text-white/65">
            Cadastre-se agora e transforme o acompanhamento das suas pacientes. Sem cartão de
            crédito, sem compromisso.
          </p>
          <Link href="/register">
            <Button
              className="gap-2 px-10 font-semibold text-primary shadow-lg"
              size="lg"
              variant="secondary"
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}
