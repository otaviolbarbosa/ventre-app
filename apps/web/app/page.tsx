import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  History,
  Lock,
  Smartphone,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LandingAnnouncementBanner } from "./_components/landing-announcement-banner";
import { LandingFeatureBlock } from "./_components/landing-feature-block";
import heroBG from "@/assets/hero-bg-3.png";
import screenshotAgenda from "@/assets/screenshot-agenda.png";
import screenshotContratos from "@/assets/screenshot-contratos.png";
import screenshotFinanceiro from "@/assets/screenshot-financeiro.png";
import screenshotHome from "@/assets/screenshot-home-profissional.png";
import screenshotPrenatal from "@/assets/screenshot-prontuario-prenatal.png";
import screenshotTimeCuidado from "@/assets/screenshot-time-cuidado.png";
import { PublicFooter } from "@/components/shared/public-footer";
import { PublicHeader } from "@/components/shared/public-header";
import { RotatingHeroWord } from "@/components/shared/rotating-hero-word";

const trustItems = [
  "Plano gratuito para começar",
  "Sem cartão de crédito",
  "Suporte em português",
  "Dados hospedados no Brasil",
];

const specialties = [
  "Doulas",
  "Médicas obstetras",
  "Enfermeiras obstétricas",
  "Consultoras de amamentação",
  "Casas de parto",
  "Equipes de parto domiciliar",
  "Secretárias e gestoras",
];

const benefits = [
  {
    Icon: Bell,
    text: "Lembretes de DPP e de parcela chegam antes de você lembrar",
  },
  {
    Icon: Smartphone,
    text: "Instale como app no celular e receba avisos com o app fechado",
  },
  {
    Icon: Building2,
    text: "Atue em várias empresas com os dados de cada uma isolados",
  },
  {
    Icon: History,
    text: "Toda ação relevante fica registrada, com autor e data",
  },
  {
    Icon: Download,
    text: "Relatório de cobranças em PDF, por profissional ou pela empresa",
  },
  {
    Icon: Lock,
    text: "Documentos da paciente só abrem por link temporário assinado",
  },
];

const personas = [
  {
    Icon: Users,
    title: "Profissional autônoma",
    body: "Você é a dona da sua agenda e do seu contrato. O Ventre organiza sem impor processo de ninguém.",
    items: [
      "Contrato base com as suas cláusulas",
      "Cobranças e relatório no seu nome",
      "Google Agenda opt-in",
    ],
  },
  {
    Icon: FileText,
    title: "Time multidisciplinar",
    body: "Vocês se revezam no cuidado de cada gestante — o registro é um só, e ninguém chega sem contexto.",
    items: [
      "Titulares e backups por paciente",
      "Convites com aceite ou recusa",
      "Prontuário compartilhado",
    ],
  },
  {
    Icon: Building2,
    title: "Casa de parto ou empresa",
    body: "Você responde pelo todo: equipe, finanças e padronização documental da organização.",
    items: [
      "Financeiro consolidado por mês",
      "Taxas, impostos e descontos",
      "Contrato base da empresa",
    ],
  },
];

const securityCards = [
  {
    title: "Dados no Brasil",
    body: "Hospedagem e processamento em território nacional, alinhados à LGPD.",
  },
  {
    title: "Isolamento por empresa",
    body: "Cobranças, agenda e gestações de uma organização não vazam para outra.",
  },
  {
    title: "Trilha de auditoria",
    body: "Registros de atividade gravados pelo sistema, sem possibilidade de edição.",
  },
  {
    title: "Arquivos protegidos",
    body: "Documentos servidos por URL assinada e temporária, nunca por link público.",
  },
];

const testimonials = [
  {
    quote:
      "Eu chegava na consulta lendo anotação de caderno. Agora abro o cartão da gestante e sei em que semana ela está, o que foi pedido e o que falta.",
    initials: "AM",
    name: "A. M.",
    role: "Enfermeira obstétrica",
  },
  {
    quote:
      "O gráfico de ganho de peso sobre a curva me poupou uma conversa difícil tarde demais. Vi o desvio na 26ª semana.",
    initials: "CR",
    name: "C. R.",
    role: "Médica obstetra",
  },
  {
    quote:
      "Cobrança parcelada era o que mais me consumia. Hoje o dashboard me diz o que está em atraso sem eu abrir planilha.",
    initials: "JS",
    name: "J. S.",
    role: "Doula",
  },
  {
    quote:
      "Padronizei o contrato base da casa e parei de revisar cláusula por profissional. A assinatura com verificação pública fechou a questão.",
    initials: "LF",
    name: "L. F.",
    role: "Gestora de casa de parto",
  },
];

const howItWorksSteps = [
  {
    number: "01",
    title: "Crie sua conta",
    description: "Menos de dois minutos, sem cartão de crédito.",
  },
  {
    number: "02",
    title: "Monte seu time",
    description: "Convide obstetras, enfermeiras e doulas para o cuidado.",
  },
  {
    number: "03",
    title: "Cadastre a primeira gestante",
    description: "Dados da gestação e início do acompanhamento.",
  },
  {
    number: "04",
    title: "Acompanhe com contexto",
    description: "Prontuário, agenda, contrato e financeiro no mesmo lugar.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <PublicHeader />
      <div className="mt-16">
        <LandingAnnouncementBanner />
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14 pb-0 sm:pt-16">
        <Image
          alt=""
          src={heroBG}
          className="absolute inset-0 h-full w-full object-cover opacity-[0.16]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/90 to-background" />
        <div className="-top-16 absolute right-[12%] z-0 h-[420px] w-[420px] rounded-full bg-primary/[0.07] blur-[110px]" />

        <div className="container relative z-10 mx-auto grid gap-12 px-6 pb-16 lg:grid-cols-[1fr_480px] lg:items-center lg:gap-14">
          <div className="flex flex-col gap-6">
            <Badge className="hero-animate hero-animate-1 w-fit gap-1.5 bg-secondary font-semibold text-secondary-foreground text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Feito para doulas, obstetras e enfermeiras obstétricas
            </Badge>

            <h1
              className="hero-animate hero-animate-2 font-bold font-poppins text-foreground leading-[1.06] tracking-tight"
              style={{ fontSize: "clamp(2.4rem, 5vw, 3.9rem)" }}
            >
              Cuidado <span className="text-primary">integrado</span> para{" "}
              <RotatingHeroWord />
            </h1>

            <p className="hero-animate hero-animate-3 max-w-[520px] text-foreground/65 text-lg leading-relaxed">
              O prontuário, a agenda, o time de cuidado e o financeiro de cada gestante no mesmo
              lugar. Você chega na consulta sabendo exatamente onde ela está.
            </p>

            <div className="hero-animate hero-animate-4 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button className="gradient-primary gap-2 px-10 shadow-soft" size="xl">
                  Começar gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/#f-1a">
                <Button className="px-10" size="xl" variant="outline">
                  Ver o Ventre por dentro
                </Button>
              </Link>
            </div>

            <div className="hero-animate hero-animate-5 flex flex-wrap gap-x-6 gap-y-2">
              {trustItems.map((item) => (
                <div className="flex items-center gap-1.5 text-[13.5px] text-foreground/55" key={item}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary/75" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="hero-animate hero-animate-3 relative mx-auto w-[300px] sm:w-[340px]">
            <div className="-inset-6 absolute rounded-[32px] bg-secondary/70 blur-3xl" />
            <div className="relative rounded-[22px] border border-border bg-white p-3 shadow-[0_30px_60px_-28px_hsl(15_20%_22%/0.4)]">
              <Image
                src={screenshotHome}
                alt="Home da profissional no app Ventre"
                className="block w-full rounded-[14px]"
              />
            </div>
          </div>
        </div>

        <div className="relative mt-8 leading-none sm:mt-16">
          <svg
            className="block w-full fill-white"
            viewBox="0 0 1440 60"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>divisor</title>
            <path d="M0 30C360 60 1080 0 1440 30V60H0V30Z" />
          </svg>
        </div>
      </section>

      {/* ── Especialidades ──────────────────────────────────── */}
      <section className="bg-white px-6 pt-4 pb-14 sm:pb-16">
        <div className="container mx-auto">
          <p className="mb-5 text-center text-[13px] text-muted-foreground uppercase tracking-[0.12em]">
            Quem já cuida de gestantes com o Ventre
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary" className="font-semibold text-xs">
                {specialty}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seis benefícios ─────────────────────────────────── */}
      <section className="bg-white px-6 pb-20 sm:pb-24">
        <div className="container mx-auto">
          <h2 className="max-w-xl font-bold font-poppins text-3xl leading-tight tracking-tight md:text-4xl">
            Menos planilha, menos grupo de WhatsApp,{" "}
            <span className="text-primary">mais tempo com ela</span>
          </h2>
          <p className="mt-3 max-w-md text-foreground/60 text-lg">
            Seis coisas que deixam de ocupar espaço na sua cabeça.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ Icon, text }) => (
              <div
                key={text}
                className="flex flex-col gap-3.5 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium text-[16.5px] leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ─────────────────────────────────── */}
      <section className="border-border/70 border-t bg-muted/55 px-6 py-20 sm:py-24">
        <div className="container mx-auto flex flex-col gap-20 sm:gap-24">
          <div className="text-center">
            <p className="mb-3 font-semibold text-primary text-xs uppercase tracking-[0.12em]">
              O que você faz no Ventre
            </p>
            <h2 className="mx-auto max-w-2xl font-bold font-poppins text-3xl leading-tight tracking-tight md:text-4xl">
              Cinco frentes do seu trabalho, uma plataforma só
            </h2>
          </div>

          <LandingFeatureBlock
            eyebrow="Prontuário pré-natal"
            title="Toda a gestação dela em uma linha do tempo"
            description="Evoluções de consulta, histórico obstétrico, fatores de risco, vacinas, exames laboratoriais e de imagem, ultrassonografias e documentos anexados. E os gráficos de ganho de peso e altura uterina desenhados sobre as curvas de referência CONMAI/IOM e INTERGROWTH-21st."
            bullets={[
              "Cartão da gestante com o resumo de todo o acompanhamento",
              "Desvios de crescimento visíveis antes de virarem problema",
              "Documentos baixados por link assinado, nunca expostos",
            ]}
            image={screenshotPrenatal}
            imageAlt="Prontuário pré-natal no Ventre, com evoluções da gestação e gráficos de ganho de peso e altura uterina"
          />

          <LandingFeatureBlock
            eyebrow="Time de cuidado"
            title="Titular, backup e ninguém descoberto"
            description="Monte o time de cada gestante com titulares e backups. Convide por e-mail ou busque uma profissional já cadastrada por nome e especialidade — ela aceita ou recusa, e todo mundo vê o status. Plantão, férias e imprevisto deixam de ser conversa de última hora."
            image={screenshotTimeCuidado}
            imageAlt="Equipe de cuidado no Ventre, com titulares, backups e convite de profissional"
            reverse
          />

          <LandingFeatureBlock
            eyebrow="Agenda"
            title="Sua agenda do Ventre, no seu Google Agenda"
            description="Conecte o Google Agenda quando quiser: criar, mudar ou cancelar uma consulta no Ventre reflete no seu calendário pessoal, sem agendar duas vezes. E quando um parto vira o seu dia de cabeça para baixo, você cancela a agenda inteira de uma vez."
            image={screenshotAgenda}
            imageAlt="Agenda no Ventre, com calendário mensal e consultas do dia, no desktop e no celular"
          />

          <LandingFeatureBlock
            eyebrow="Financeiro"
            title="Você sabe quanto entra, quando entra e quanto sobra"
            description="Cobranças com parcelas, dashboard por mês com navegação para trás e para frente, atraso marcado automaticamente e relatório em PDF por profissional ou pela empresa. Impostos, taxas e descontos configurados pela gestora aparecem discriminados — o valor líquido nunca é surpresa."
            image={screenshotFinanceiro}
            imageAlt="Dashboard financeiro no Ventre, com valores recebidos, a receber e em atraso"
            reverse
          />

          <LandingFeatureBlock
            id="contratos-1a"
            eyebrow="Contratos"
            title="Do contrato base à assinatura verificável"
            description="Escreva suas cláusulas uma vez e reutilize em cada gestante. O cabeçalho jurídico — contratante, contratada (você ou a empresa) e o time de cuidado — sai pronto dos dados já cadastrados. Exporte em PDF, que é arquivado no prontuário dela, com selo de assinatura digital e uma página pública para conferir a validade pelo código."
            image={screenshotContratos}
            imageAlt="Editor de contratos no Ventre, com cláusulas e geração do documento"
          />
        </div>
      </section>

      {/* ── Personas ────────────────────────────────────────── */}
      <section id="personas-1a" className="bg-white px-6 py-20 sm:py-24">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <p className="mb-3 font-semibold text-primary text-xs uppercase tracking-[0.12em]">
              Para quem é
            </p>
            <h2 className="mx-auto max-w-xl font-bold font-poppins text-3xl leading-tight tracking-tight md:text-4xl">
              Sozinha, em time ou com uma casa inteira para gerir
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map(({ Icon, title, body, items }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold font-poppins text-xl leading-tight">{title}</h3>
                <p className="text-[15px] text-foreground/60 leading-relaxed">{body}</p>
                <ul className="mt-auto flex flex-col gap-2 pt-1">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[14px] text-foreground/75 leading-relaxed"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segurança e privacidade ─────────────────────────── */}
      <section id="seg-1a" className="bg-[hsl(15,20%,16%)] px-6 py-20 text-[hsl(25,40%,95%)] sm:py-24">
        <div className="container mx-auto grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="mb-3.5 font-semibold text-[hsl(14,60%,66%)] text-xs uppercase tracking-[0.12em]">
              Segurança e privacidade
            </p>
            <h2 className="mb-5 font-bold font-poppins text-3xl leading-tight tracking-tight md:text-[38px]">
              Dado de saúde é dado sensível. Tratamos como tal.
            </h2>
            <p className="mb-6 text-[17px] text-[hsl(25,30%,88%)]/70 leading-relaxed">
              Nunca vendemos nem compartilhamos os dados das suas pacientes. Cada empresa vê só o
              que é dela, cada ação relevante fica registrada, e todo arquivo é baixado por link
              temporário assinado.
            </p>
            <Link
              href="/policies"
              className="inline-flex items-center gap-2 font-semibold text-[15px] text-[hsl(14,60%,70%)]"
            >
              Como tratamos os dados
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {securityCards.map(({ title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-[hsl(25,20%,30%)] bg-[hsl(15,18%,21%)] p-6"
              >
                <p className="mb-1.5 font-semibold text-[15.5px] text-[hsl(25,40%,95%)]">
                  {title}
                </p>
                <p className="text-[13.5px] text-[hsl(25,25%,85%)]/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ─────────────────────────────────────── */}
      <section className="bg-muted/55 px-6 py-20 sm:py-24">
        <div className="container mx-auto">
          <h2 className="mb-10 max-w-lg font-bold font-poppins text-3xl leading-tight tracking-tight md:text-[38px]">
            Quem cuida, contando como é
          </h2>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
            {testimonials.map(({ quote, initials, name, role }) => (
              <figure
                key={initials}
                className="flex w-[340px] shrink-0 snap-start flex-col gap-5 rounded-2xl border border-border bg-white p-6 shadow-sm sm:w-[380px]"
              >
                <blockquote className="text-[17px] text-foreground/85 leading-relaxed">
                  “{quote}”
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground text-sm">
                    {initials}
                  </span>
                  <span>
                    <span className="block font-semibold text-[14.5px]">{name}</span>
                    <span className="block text-muted-foreground text-[13px]">{role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            [ depoimentos ilustrativos — substituir por citações reais com autorização ]
          </p>
        </div>
      </section>

      {/* ── Como funciona ───────────────────────────────────── */}
      <section className="bg-white px-6 py-20 sm:py-24">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <p className="mb-3 font-semibold text-primary text-xs uppercase tracking-[0.12em]">
              Como começa
            </p>
            <h2 className="font-bold font-poppins text-3xl tracking-tight md:text-[38px]">
              Em minutos, não em horas
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map(({ number, title, description }) => (
              <div
                key={number}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <div className="gradient-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl font-bold text-lg text-white shadow-soft">
                  {number}
                </div>
                <h3 className="mb-2 font-semibold text-[16.5px]">{title}</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal da gestante — Em breve ────────────────────── */}
      <section className="border-border/70 border-t bg-secondary/55 px-6 py-16">
        <div className="container mx-auto flex flex-wrap items-center gap-10">
          <div className="flex-1 basis-[420px]">
            <Badge className="mb-3.5 border border-border bg-white font-semibold text-primary text-xs">
              Em breve
            </Badge>
            <h2 className="mb-3 max-w-xl font-bold font-poppins text-2xl leading-tight tracking-tight md:text-[32px]">
              Um espaço para a gestante acompanhar a própria jornada
            </h2>
            <p className="max-w-lg text-[16.5px] text-foreground/60 leading-relaxed">
              Ela vai poder ver as consultas marcadas, os documentos e o andamento do pré-natal —
              sempre com o que a equipe de cuidado decidir compartilhar.
            </p>
          </div>
          <Link href="/#planos-1a">
            <Button className="gap-2 px-8" size="lg" variant="outline">
              Quero ser avisada
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────── */}
      <section id="planos-1a" className="relative overflow-hidden px-6 py-24 sm:py-28">
        <div className="gradient-cta absolute inset-0" />
        <div className="-left-32 -top-32 absolute h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="-bottom-32 -right-32 absolute h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className="container relative mx-auto text-center">
          <h2 className="mx-auto mb-4 max-w-xl font-bold font-poppins text-4xl text-white leading-tight md:text-[46px]">
            Comece hoje, com as gestantes que você já acompanha
          </h2>
          <p className="mx-auto mb-9 max-w-md text-lg text-white/70 leading-relaxed">
            Plano gratuito para começar. Sem cartão de crédito, sem compromisso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register">
              <Button className="gap-2 bg-secondary px-10 text-primary hover:bg-secondary/90" size="xl">
                Criar conta grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/paywall">
              <Button
                className="border-white/45 bg-transparent px-10 text-white hover:bg-white/10 hover:text-white"
                size="xl"
                variant="outline"
              >
                Ver planos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
