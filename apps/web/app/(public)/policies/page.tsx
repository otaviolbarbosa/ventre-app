import { LegalDocument } from "@/components/shared/legal-document";
import { policiesMeta, policiesSections } from "@/content/legal/policies-content";

export default function PoliciesPage() {
  return (
    <LegalDocument
      title={policiesMeta.title}
      subtitle={policiesMeta.subtitle}
      version={policiesMeta.version}
      effectiveDate={policiesMeta.effectiveDate}
      sections={policiesSections}
    />
  );
}
