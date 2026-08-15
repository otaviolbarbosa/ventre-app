"use server";

import { enqueueNotification } from "@/lib/notifications/queue";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { createContractChangeRequestSchema } from "@/lib/validations/contract-change-request";
import { revalidatePath } from "next/cache";

export const createContractChangeRequestAction = authActionClient
  .inputSchema(createContractChangeRequestSchema)
  .action(async ({ parsedInput: { patientId, messageHtml }, ctx: { supabase, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas a gestante pode solicitar alteração no contrato.");
    }

    const { data: patientRow } = await supabase
      .from("patients")
      .select("id, user_id, name, created_by")
      .eq("id", patientId)
      .single();

    if (!patientRow || patientRow.user_id !== user.id) {
      throw new Error("Você não tem permissão para solicitar alteração neste contrato.");
    }

    const { data: existing } = await supabase
      .from("contracts")
      .select("id, fully_signed_at")
      .eq("patient_id", patientId)
      .eq("is_base_contract", false)
      .eq("is_active", true)
      .maybeSingle();

    if (!existing) throw new Error("Nenhum contrato encontrado.");
    if (existing.fully_signed_at) {
      throw new Error(
        "Este contrato já foi assinado por ambas as partes. Solicite uma revisão pelos canais de revogação.",
      );
    }

    const { error } = await supabase.from("contract_change_requests").insert({
      contract_id: existing.id,
      patient_id: patientId,
      requested_by: user.id,
      message_html: messageHtml,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma solicitação de alteração pendente para este contrato.");
      }
      throw new Error("Erro ao enviar solicitação. Tente novamente.");
    }

    revalidatePath(`/patients/${patientId}/profile`);
    revalidatePath("/home");
    revalidatePath(`/contrato/${existing.id}`);

    if (patientRow.created_by) {
      sendWhatsAppToUser(
        { recipientType: "user", recipientId: patientRow.created_by },
        "contract_change_requested",
        { patientName: patientRow.name ?? "" },
        { referenceType: "contract", referenceId: existing.id },
      ).catch((err) => {
        console.error("[whatsapp] contract_change_requested send failed", err);
      });

      enqueueNotification({
        queueName: "push_notifications",
        notificationType: "contract_change_requested",
        referenceType: "contract",
        referenceId: existing.id,
        recipientType: "user",
        recipientId: patientRow.created_by,
      }).catch((err) => {
        console.error("[push] contract_change_requested enqueue failed", err);
      });
    }

    await captureServerEvent(user.id, "create_contract_change_request", {
      patient_id: patientId,
      contract_id: existing.id,
    });

    return { success: true };
  });
