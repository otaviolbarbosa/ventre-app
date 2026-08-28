import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ventre/ui/accordion";
import { Card, CardContent } from "@ventre/ui/card";
import { Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalDocument({
  title,
  subtitle,
  version,
  effectiveDate,
  sections,
}: {
  title: string;
  subtitle: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-poppins font-semibold text-3xl text-foreground">{title}</h1>
      <p className="mt-4 text-muted-foreground">{subtitle}</p>

      <Card className="mt-8">
        <CardContent className="grid gap-1 p-5 text-muted-foreground text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Operadora:</span> Timani Tecnologia
            Desenvolvimento de Software Ltda.
          </p>
          <p>
            <span className="font-medium text-foreground">CNPJ:</span> 68.107.944/0001-04
          </p>
          <p>
            <span className="font-medium text-foreground">Versão:</span> {version}
          </p>
          <p>
            <span className="font-medium text-foreground">Última atualização:</span> {effectiveDate}
          </p>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="mt-8">
        {sections.map((section, index) => (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="font-poppins text-base text-foreground hover:no-underline">
              <span className="text-left">
                {index + 1}. {section.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
                {section.content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Card className="mt-8">
        <CardContent className="space-y-3 p-5 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Contato e encarregado(a) pelo tratamento de dados
          </p>
          <p className="text-muted-foreground">
            Otávio Bruno Leite Barbosa, sócio da Timani, é o encarregado (DPO) responsável por
            atender dúvidas e solicitações sobre estes documentos e sobre o tratamento de dados
            pessoais no Ventre.
          </p>
          <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
            <a
              href="mailto:falecom@ventre.app"
              className="flex items-center gap-2 transition-colors hover:text-foreground"
            >
              <Mail className="size-4 shrink-0" />
              falecom@ventre.app
            </a>
            <a
              href="tel:+5561996979671"
              className="flex items-center gap-2 transition-colors hover:text-foreground"
            >
              <Phone className="size-4 shrink-0" />
              (61) 99697-9671
            </a>
            <p className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              Rua 1, QR 414, Conjunto 9A, Lote 1, apartamento 102, Setor Habitacional Vicente Pires,
              Brasília/DF, CEP 72.005-100.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
