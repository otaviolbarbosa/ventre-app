import { z } from "zod";

export const requestEnterpriseSchema = z.object({
  name: z.string().min(1, "Nome da organização é obrigatório"),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  zipcode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  professionals_amount: z.number().int().default(5),
});

export type RequestEnterpriseInput = z.infer<typeof requestEnterpriseSchema>;
