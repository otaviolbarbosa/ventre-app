"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { dayjs } from "@/lib/dayjs";
import { z } from "zod";

export const confirmInstallmentPaymentAction = authActionClient
  .inputSchema(
    z.object({
      installmentId: z.string().uuid(),
      decision: z.enum(["confirm", "reject"]),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("id, status, due_date, billing_id, billings(patient_id, patient:patients(name))")
      .eq("id", parsedInput.installmentId)
      .single();

    if (!installment) {
      throw new Error("Parcela não encontrada.");
    }

    if (installment.status !== "em_analise") {
      throw new Error("Esta parcela não está em análise.");
    }

    const billing = installment.billings as {
      patient_id: string;
      patient: { name: string } | null;
    } | null;

    if (!billing) {
      throw new Error("Cobrança não encontrada.");
    }

    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("patient_id", billing.patient_id)
      .eq("professional_id", user.id)
      .maybeSingle();

    if (!membership) {
      throw new Error("Você não tem permissão para confirmar este pagamento.");
    }

    if (parsedInput.decision === "confirm") {
      const { error } = await supabaseAdmin
        .from("installments")
        .update({ status: "pago", paid_at: new Date().toISOString() })
        .eq("id", parsedInput.installmentId);

      if (error) throw new Error(error.message);
    } else {
      const isOverdue = dayjs(installment.due_date).isBefore(dayjs(), "day");
      const { error } = await supabaseAdmin
        .from("installments")
        .update({ status: isOverdue ? "atrasado" : "pendente" })
        .eq("id", parsedInput.installmentId);

      if (error) throw new Error(error.message);
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName:
          parsedInput.decision === "confirm" ? "Pagamento confirmado" : "Pagamento rejeitado",
        description: billing.patient
          ? `Pagamento ${parsedInput.decision === "confirm" ? "confirmado" : "rejeitado"} para ${billing.patient.name}`
          : "Pagamento atualizado",
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing.patient_id,
        metadata: { installment_id: parsedInput.installmentId, decision: parsedInput.decision },
      });
    }

    return { success: true };
  });
