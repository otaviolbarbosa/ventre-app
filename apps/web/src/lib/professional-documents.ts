import type { ProfessionalType } from "@/types";
import type { Json } from "@ventre/supabase/types";

const REQUIRED_DOCUMENT_KEY: Partial<Record<ProfessionalType, "crm" | "crefito" | "coren">> = {
  obstetra: "crm",
  fisio: "crefito",
  enfermeiro: "coren",
};

export function needsProfessionalDocuments(
  professionalType: ProfessionalType | null,
  professionalDocuments: Json | null,
): boolean {
  if (!professionalType) return false;
  const requiredKey = REQUIRED_DOCUMENT_KEY[professionalType];
  if (!requiredKey) return false;
  const documents = professionalDocuments as Record<string, unknown> | null;
  return !documents?.[requiredKey];
}
