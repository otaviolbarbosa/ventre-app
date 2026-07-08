import { z } from "zod";

const DEFAULT_TITLE = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";

export const saveBaseContractSchema = z.object({
  title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type SaveBaseContractInput = z.infer<typeof saveBaseContractSchema>;

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
