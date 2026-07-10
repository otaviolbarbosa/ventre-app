import { z } from "zod";
import { createBillingSchema } from "./billing";

export const createPatientInviteSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.union([z.string().email("Email inválido"), z.literal("")]).optional(),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
  professional_ids: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos uma profissional")
    .optional(),
  backup_professional_ids: z.array(z.string().uuid()).optional(),
  enterprise_id: z.string().uuid().nullable().optional(),
  billing: createBillingSchema.omit({ patient_id: true }).optional(),
});

export type CreatePatientInviteInput = z.infer<typeof createPatientInviteSchema>;

export const patientSelfRegistrationSchema = z.object({
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.union([z.string().email("Email inválido"), z.literal("")]).optional(),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
  partner_name: z.string().optional(),
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
});

export type PatientSelfRegistrationInput = z.infer<typeof patientSelfRegistrationSchema>;

export const linkExistingPatientRegistrationSchema = z.object({
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
});

export type LinkExistingPatientRegistrationInput = z.infer<
  typeof linkExistingPatientRegistrationSchema
>;
