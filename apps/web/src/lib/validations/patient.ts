import { z } from "zod";

export const createPatientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  date_of_birth: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data de nascimento inválida",
  }),
  due_date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data prevista do parto inválida",
  }),
  dum: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data da última menstruação inválida",
  }),
  address: z.string().optional(),
  observations: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
