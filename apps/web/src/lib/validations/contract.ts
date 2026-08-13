import { z } from "zod";

const DEFAULT_TITLE = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";

function isRichTextEmpty(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export const patientContractFormSchema = z.object({
  title: z.string().min(1, "O título não pode estar vazio"),
  city: z.string().min(1, "A cidade não pode estar vazia"),
  state: z.string().min(1, "O estado não pode estar vazio"),
  clauses_html: z
    .string()
    .refine((html) => !isRichTextEmpty(html), "As cláusulas não podem estar vazias"),
});

export type PatientContractFormValues = z.infer<typeof patientContractFormSchema>;

export const saveBaseContractSchema = z.object({
  contractId: z.string().uuid().optional(),
  name: z.string().min(1, "O nome não pode estar vazio").optional(),
  title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type SaveBaseContractInput = z.infer<typeof saveBaseContractSchema>;

export const createBaseContractFromPatientSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1, "O nome do contrato não pode estar vazio"),
  title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type CreateBaseContractFromPatientInput = z.infer<
  typeof createBaseContractFromPatientSchema
>;

export const getPatientContractSchema = z.object({
  patientId: z.string().uuid(),
});

export const savePatientContractSchema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type SavePatientContractInput = z.infer<typeof savePatientContractSchema>;

export const signPatientContractSchema = savePatientContractSchema.extend({
  consent: z.literal(true, {
    errorMap: () => ({ message: "É necessário aceitar os termos para assinar" }),
  }),
});

export type SignPatientContractInput = z.infer<typeof signPatientContractSchema>;
