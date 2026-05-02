"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  billingId: z.string().uuid("ID da cobrança inválido"),
  installmentId: z.string().uuid("ID da parcela inválido"),
  paymentLink: z.string().url("URL inválida").or(z.literal("")),
});

export const saveInstallmentLinkAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("id")
      .eq("id", parsedInput.installmentId)
      .eq("billing_id", parsedInput.billingId)
      .single();

    if (!installment) throw new Error("Parcela não encontrada");

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ payment_link: parsedInput.paymentLink || null })
      .eq("id", parsedInput.installmentId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: billing } = await supabaseAdmin
        .from("billings")
        .select("patient_id, patient:patients(name)")
        .eq("id", parsedInput.billingId)
        .single();
      const patient = billing?.patient as { name: string } | null;

      insertActivityLog({
        supabaseAdmin,
        actionName: "Link de pagamento salvo",
        description: patient
          ? `Link de pagamento salvo para cobrança de ${patient.name}`
          : "Link de pagamento salvo",
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing?.patient_id ?? null,
        metadata: { billing_id: parsedInput.billingId, installment_id: parsedInput.installmentId },
      });
    }

    return { success: true };
  });
