import { z } from "zod";

// Must stay in sync with ESTADOS_BR in lib/constants.ts (no existing sync mechanism to build on).
const ufSiglas = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const documentEntrySchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Número é obrigatório")
    .regex(/^\d+$/, "Apenas números"),
  uf: z.enum(ufSiglas, { required_error: "UF é obrigatória" }),
});

export const professionalDocumentsSchema = z.object({
  crm: documentEntrySchema.optional(),
  crefito: documentEntrySchema.optional(),
  coren: documentEntrySchema.optional(),
  rqe: z.array(documentEntrySchema).optional(),
});

export type ProfessionalDocumentsInput = z.infer<typeof professionalDocumentsSchema>;
