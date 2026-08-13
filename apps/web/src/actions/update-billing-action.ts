"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  billingId: z.string().uuid("ID da cobrança inválido"),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado"]),
});

export const updateBillingAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: billing, error } = await supabase
      .from("billings")
      .update({ status: parsedInput.status })
      .eq("id", parsedInput.billingId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: patient } = await supabase
      .from("patients")
      .select("id, name")
      .eq("id", billing.patient_id)
      .single();

    if (patient) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        "billing_status_updated",
        { patientName: patient.name, status: parsedInput.status },
      ).catch((err) => {
        console.error("[whatsapp] billing_status_updated send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Cobrança atualizada",
        description: patient
          ? `Status da cobrança de ${patient.name} atualizado para ${parsedInput.status}`
          : `Status da cobrança atualizado para ${parsedInput.status}`,
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing.patient_id,
        metadata: { billing_id: parsedInput.billingId, status: parsedInput.status },
      });
    }

    await captureServerEvent(user.id, "update_billing", {
      billing_id: parsedInput.billingId,
      status: parsedInput.status,
    });

    return { billing };
  });
