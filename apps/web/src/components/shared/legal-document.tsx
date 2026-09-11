import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ventre/ui/accordion";
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

      <p className="mt-8 text-muted-foreground text-sm">
        <span className="font-medium text-foreground">Versão:</span> {version} ·{" "}
        <span className="font-medium text-foreground">Última atualização:</span> {effectiveDate}
      </p>
    </main>
  );
}
