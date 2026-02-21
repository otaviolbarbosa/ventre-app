import { z } from "zod";
import type { Database } from "@nascere/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const paymentMethods = [
  "credito",
  "debito",
  "pix",
  "boleto",
  "dinheiro",
  "outro",
] as const satisfies readonly PaymentMethod[];

export const createBillingSchema = z.object({
  patient_id: z.string().uuid("ID do paciente inválido"),
  description: z
    .string()
    .min(3, "Descrição deve ter pelo menos 3 caracteres")
    .max(200, "Descrição deve ter no máximo 200 caracteres"),
  total_amount: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .positive("Valor deve ser positivo"),
  payment_method: z.enum(paymentMethods, {
    required_error: "Método de pagamento é obrigatório",
  }),
  installment_count: z
    .number()
    .int()
    .min(1, "Mínimo de 1 parcela")
    .max(10, "Máximo de 10 parcelas")
    .default(1),
  installment_interval: z
    .number()
    .int()
    .min(1, "Intervalo mínimo de 1 mês")
    .max(4, "Intervalo máximo de 4 meses")
    .default(1),
  first_due_date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Data de vencimento inválida",
  }),
  payment_links: z
    .array(z.union([z.string().url("URL de pagamento inválida"), z.literal("")]))
    .max(10, "Máximo de 10 links de pagamento")
    .optional(),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

export const updateBillingSchema = z.object({
  description: z
    .string()
    .min(3, "Descrição deve ter pelo menos 3 caracteres")
    .max(200, "Descrição deve ter no máximo 200 caracteres")
    .optional(),
  total_amount: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .positive("Valor deve ser positivo")
    .optional(),
  payment_method: z.enum(paymentMethods).optional(),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

export const recordPaymentSchema = z.object({
  paid_at: z
    .string()
    .refine((date) => !Number.isNaN(Date.parse(date)), {
      message: "Data de pagamento inválida",
    })
    .refine((date) => new Date(date) <= new Date(), {
      message: "Data de pagamento não pode ser futura",
    }),
  paid_amount: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .positive("Valor deve ser positivo"),
  payment_method: z.enum(paymentMethods, {
    required_error: "Método de pagamento é obrigatório",
  }),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

export type CreateBillingInput = z.infer<typeof createBillingSchema>;
export type UpdateBillingInput = z.infer<typeof updateBillingSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
