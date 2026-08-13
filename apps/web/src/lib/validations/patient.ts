import { z } from "zod";
import { createBillingSchema } from "./billing";

export const MARITAL_STATUS_OPTIONS = [
  { value: "solteira", label: "Solteira" },
  { value: "casada", label: "Casada" },
  { value: "uniao_estavel", label: "União estável" },
  { value: "divorciada", label: "Divorciada" },
  { value: "viuva", label: "Viúva" },
] as const;

export type MaritalStatus = (typeof MARITAL_STATUS_OPTIONS)[number]["value"];

export const createPatientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.union([z.string().email("Email inválido"), z.literal("")]).optional(),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
  partner_name: z.string().optional(),
  rg: z.string().optional(),
  cpf: z.string().optional(),
  marital_status: z
    .enum(MARITAL_STATUS_OPTIONS.map((o) => o.value) as [MaritalStatus, ...MaritalStatus[]])
    .optional(),
  occupation: z.string().optional(),
  due_date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data prevista do parto inválida",
  }),
  dum: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data da última menstruação inválida",
  }),
  address: z
    .object({
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      complement: z.string().optional(),
      number: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
    })
    .optional(),
  baby_name: z.string().optional(),
  observations: z.string().optional(),
  professional_ids: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos uma profissional")
    .optional(),
  backup_professional_ids: z.array(z.string().uuid()).optional(),
  enterprise_id: z.string().uuid().nullable().optional(),
  billing: createBillingSchema.omit({ patient_id: true }).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
