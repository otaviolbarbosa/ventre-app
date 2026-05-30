import type { ProfessionalType } from "@/types";

export const professionalTypeLabels: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
  fisio: "Fisioterapeuta",
} satisfies Record<ProfessionalType, string>;
