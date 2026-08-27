"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const paymentMethods = ["credito", "debito", "pix", "boleto", "dinheiro", "outro"] as const;

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export const registerInstallmentPaymentAction = authActionClient
  .inputSchema(
    z.object({
      installmentId: z.string().uuid(),
      paidAt: z
        .string()
        .refine((date) => !Number.isNaN(Date.parse(date)), "Data de pagamento inválida.")
        .refine((date) => new Date(date) <= new Date(), "Data de pagamento não pode ser futura."),
      paidAmount: z
        .number()
        .int("Valor deve ser inteiro (centavos).")
        .positive("Valor deve ser positivo."),
      paymentMethod: z.enum(paymentMethods),
      receiptFile: z
        .instanceof(File)
        .refine((file) => file.size <= MAX_RECEIPT_SIZE, "O comprovante deve ter até 10MB.")
        .refine(
          (file) => ALLOWED_RECEIPT_TYPES.includes(file.type),
          "Tipo de arquivo não permitido. Envie imagens ou PDF.",
        )
        .optional(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas pacientes podem registrar pagamentos.");
    }

    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("id, status, amount, billing_id, billings(patient_id, patients(user_id))")
      .eq("id", parsedInput.installmentId)
      .single();

    if (!installment) {
      throw new Error("Parcela não encontrada.");
    }

    const billing = installment.billings as {
      patient_id: string;
      patients: { user_id: string | null } | null;
    } | null;
    const ownerUserId = billing?.patients?.user_id;

    if (!ownerUserId || ownerUserId !== user.id) {
      throw new Error("Você não tem permissão para registrar este pagamento.");
    }

    if (installment.status !== "pendente" && installment.status !== "atrasado") {
      throw new Error("Esta parcela não pode receber um novo pagamento.");
    }

    if (parsedInput.paidAmount > installment.amount) {
      throw new Error("O valor pago não pode ser maior que o valor da parcela.");
    }

    let receiptPath: string | undefined;
    if (parsedInput.receiptFile) {
      const timestamp = Date.now();
      receiptPath = `${user.id}/${timestamp}_${parsedInput.receiptFile.name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("payments")
        .upload(receiptPath, parsedInput.receiptFile, {
          contentType: parsedInput.receiptFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Erro ao enviar o comprovante de pagamento.");
      }
    }

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      installment_id: parsedInput.installmentId,
      paid_at: parsedInput.paidAt,
      paid_amount: parsedInput.paidAmount,
      payment_method: parsedInput.paymentMethod,
      registered_by: user.id,
      receipt_path: receiptPath ?? null,
    });

    if (paymentError) {
      if (receiptPath) {
        await supabaseAdmin.storage.from("payments").remove([receiptPath]);
      }
      throw new Error(paymentError.message);
    }

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ status: "em_analise", payment_method: parsedInput.paymentMethod })
      .eq("id", parsedInput.installmentId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
