import type { Database } from "@ventre/supabase/types";
import { z } from "zod";

type BillingFeeType = Database["public"]["Enums"]["billing_fee_type"];

const feeTypes = ["fixed", "percentage"] as const satisfies readonly BillingFeeType[];

export const createBillingFeeSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres")
      .max(100, "Nome deve ter no máximo 100 caracteres"),
    fee_type: z.enum(feeTypes, { required_error: "Tipo de taxa é obrigatório" }),
    value: z.number().positive("Valor deve ser positivo"),
  })
  .refine((data) => data.fee_type !== "percentage" || data.value <= 100, {
    message: "Percentual não pode ser maior que 100",
    path: ["value"],
  })
  .refine((data) => data.fee_type !== "fixed" || Number.isInteger(data.value), {
    message: "Valor fixo deve ser em centavos (número inteiro)",
    path: ["value"],
  });

export const updateBillingFeeSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  value: z.number().positive("Valor deve ser positivo").optional(),
});

export const toggleBillingFeeActiveSchema = z.object({
  id: z.string().uuid("ID da taxa inválido"),
  is_active: z.boolean(),
});

export type CreateBillingFeeInput = z.infer<typeof createBillingFeeSchema>;
export type UpdateBillingFeeInput = z.infer<typeof updateBillingFeeSchema>;
export type ToggleBillingFeeActiveInput = z.infer<typeof toggleBillingFeeActiveSchema>;
