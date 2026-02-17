import heroBG from "@/assets/hero-bg.jpg";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Baby, Calendar, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
export default function HomePage() {
  const benefits = [
    {
      icon: <Baby className="mb-2 h-10 w-10 text-primary" />,
      title: "Gestão de Pacientes",
      description:
        "Cadastre gestantes, acompanhe semanas gestacionais e mantenha todas as informações organizadas.",
    },
    {
      icon: <Calendar className="mb-2 h-10 w-10 text-primary" />,
      title: "Agendamentos",
      description:
        "Organize consultas e encontros, com histórico completo de atendimentos para cada paciente.",
    },
    {
      icon: <Users className="h-10 w-10 text-primary" />,
      title: "Equipe Multidisciplinar",
      description:
        "Convide obstetras, enfermeiros e doulas para colaborar no cuidado de cada gestante.",
    },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-10 border-b bg-background/80 bg-white backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo href="/" size="xl" />
          <nav className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button className="gradient-primary shadow-soft">Cadastrar</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pb:20 relative bg-gradient-to-br from-primary-50 to-secondary-50 pt-[224px] sm:pt-[264px] sm:pb-40">
        <div className="absolute inset-0 z-0">
          <Image src={heroBG} alt="hero-bg" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background" />
        </div>

        <div className="container relative mx-auto space-y-14 px-4 text-center">
          <h1 className="font-bold text-4xl text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
            Cuidado integrado para
            <span className="text-primary"> gestantes</span>
          </h1>
          <p className="mx-auto max-w-2xl text-gray-900 text-lg">
            Plataforma completa para profissionais de saúde acompanharem gestantes com organização,
            colaboração em equipe e comunicação eficiente.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gradient-primary gap-2 shadow-soft">
                Começar agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto space-y-12 px-4">
          <div className="space-y-4">
            <h2 className="text-center font-bold text-3xl">
              Tudo que você precisa para um acompanhamento de qualidade
            </h2>
            <p className="mx-auto max-w-2xl text-center text-gray-900">
              Ferramentas pensadas para facilitar seu dia a dia e oferecer o melhor cuidado às suas
              pacientes.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardHeader>
                  <span className="mb-4 flex size-16 items-center justify-center rounded-lg bg-muted">
                    {benefit.icon}
                  </span>
                  <CardTitle>{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">{benefit.description}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-cta bg-primary-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 font-bold text-3xl text-white">Comece a usar gratuitamente</h2>
          <p className="mb-8 text-primary-100 text-white">
            Cadastre-se agora e organize o acompanhamento de suas pacientes.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>&copy; {new Date().getFullYear()} Nascere. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
