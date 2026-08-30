import { z } from "zod";

export const TRADITIONAL_COMMUNITY_TYPE_OPTIONS = [
  { value: "quilombola", label: "Quilombola" },
  { value: "indigena", label: "Indígena" },
  { value: "ribeirinha", label: "Ribeirinha" },
  { value: "cigana", label: "Cigana" },
  { value: "outro", label: "Outro(a)" },
] as const;

export const RACE_COLOR_OPTIONS = [
  { value: "branca", label: "Branca" },
  { value: "preta", label: "Preta" },
  { value: "parda", label: "Parda" },
  { value: "amarela", label: "Amarela" },
  { value: "indigena", label: "Indígena" },
] as const;

export const DISABILITY_TYPE_OPTIONS = [
  { value: "auditiva", label: "Auditiva" },
  { value: "visual", label: "Visual" },
  { value: "intelectual", label: "Intelectual" },
  { value: "fisica", label: "Física" },
  { value: "estomia", label: "Estomia" },
  { value: "multiplas", label: "Múltiplas deficiências" },
  { value: "outra", label: "Outra" },
] as const;

export const EDUCATION_LEVEL_OPTIONS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "fundamental", label: "Ensino fundamental" },
  { value: "medio_tecnico", label: "Ensino médio/técnico" },
  { value: "eja", label: "Educação de Jovens e Adultos" },
  { value: "superior", label: "Ensino superior" },
  { value: "pos_graduacao", label: "Pós-graduação" },
] as const;

export const partnerSchema = z.object({
  full_name: z.string().optional(),
  preferred_name: z.string().optional(),
  birth_date: z.string().optional(),
  gender_identity: z.string().optional(),
  traditional_community: z.boolean().optional(),
  traditional_community_types: z.string().optional(), // comma-separated, parsed to array on insert
  traditional_community_other: z.string().optional(),
  race_color: z.string().optional(),
  has_disability: z.boolean().optional(),
  disability_types: z.string().optional(), // comma-separated, parsed to array on insert
  disability_other: z.string().optional(),
  education_level: z.string().optional(),
  family_history_diabetes: z.boolean().optional(),
  family_history_hypertension: z.boolean().optional(),
  family_history_twin_pregnancy: z.boolean().optional(),
  family_history_other: z.string().optional(),
});

export type PartnerInput = z.infer<typeof partnerSchema>;
