import { z } from "zod";

export const createPatientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").optional(),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
  due_date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data prevista do parto inválida",
  }),
  dum: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data da última menstruação inválida",
  }),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  complement: z.string().optional(),
  number: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  observations: z.string().optional(),
  professional_id: z.string().uuid().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
