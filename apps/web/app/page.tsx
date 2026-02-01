import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Baby, Calendar, Users } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo href="/" size="xl" />
          <nav className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button>Cadastrar</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 to-secondary-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Cuidado integrado para
            <span className="text-primary-600"> gestantes</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            Plataforma completa para profissionais de saúde acompanharem gestantes com organização,
            colaboração em equipe e comunicação eficiente.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2">
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
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Tudo que você precisa para um acompanhamento de qualidade
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Baby className="mb-2 h-10 w-10 text-primary-500" />
                <CardTitle>Gestão de Pacientes</CardTitle>
                <CardDescription>
                  Cadastre gestantes, acompanhe semanas gestacionais e mantenha todas as informações
                  organizadas.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Calendar className="mb-2 h-10 w-10 text-primary-500" />
                <CardTitle>Agendamentos</CardTitle>
                <CardDescription>
                  Organize consultas e encontros, com histórico completo de atendimentos para cada
                  paciente.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="mb-2 h-10 w-10 text-primary-500" />
                <CardTitle>Equipe Multidisciplinar</CardTitle>
                <CardDescription>
                  Convide obstetras, enfermeiros e doulas para colaborar no cuidado de cada
                  gestante.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Comece a usar gratuitamente</h2>
          <p className="mb-8 text-primary-100">
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
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Doulando. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
