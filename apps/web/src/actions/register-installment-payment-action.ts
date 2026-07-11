"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const paymentMethods = ["credito", "debito", "pix", "boleto", "dinheiro", "outro"] as const;

export const registerInstallmentPaymentAction = authActionClient
  .inputSchema(
    z.object({
      installmentId: z.string().uuid(),
      paymentMethod: z.enum(paymentMethods),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas pacientes podem registrar pagamentos.");
    }

    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("id, status, billing_id, billings(patient_id, patients(user_id))")
      .eq("id", parsedInput.installmentId)
      .single();

    if (!installment) {
      throw new Error("Parcela não encontrada.");
    }

    const billing = installment.billings as { patient_id: string; patients: { user_id: string | null } | null } | null;
    const ownerUserId = billing?.patients?.user_id;

    if (!ownerUserId || ownerUserId !== user.id) {
      throw new Error("Você não tem permissão para registrar este pagamento.");
    }

    if (installment.status !== "pendente" && installment.status !== "atrasado") {
      throw new Error("Esta parcela não pode receber um novo pagamento.");
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
