import { LegalDocument } from "@/components/shared/legal-document";
import { termsMeta, termsSections } from "@/content/legal/terms-content";

export default function TermsPage() {
  return (
    <LegalDocument
      title={termsMeta.title}
      subtitle={termsMeta.subtitle}
      version={termsMeta.version}
      effectiveDate={termsMeta.effectiveDate}
      sections={termsSections}
    />
  );
}
