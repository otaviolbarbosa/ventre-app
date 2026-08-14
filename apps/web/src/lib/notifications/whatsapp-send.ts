import { sendWhatsAppTemplateMessage, WhatsAppApiError } from "@/lib/whatsapp/client";
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type WhatsAppRecipient =
  | { recipientType: "patient"; recipientId: string }
  | { recipientType: "user"; recipientId: string }
  | { recipientType: "invite"; recipientId: string };

type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

// Referência opcional (ex: appointment id) associada ao envio, para que o webhook inbound
// (handleConfirmAppointmentPresence etc.) consiga localizar a entidade relacionada a partir
// do notification_log — mesmo padrão de reference_type/reference_id usado pelo path da fila
// (ver process-notification-queues/route.ts). Chamadores sem uma referência disponível podem
// omitir; nesse caso as colunas continuam NULL, como antes.
export type WhatsAppReference = {
  referenceType: string;
  referenceId: string;
};

export async function sendWhatsAppToUser(
  recipient: WhatsAppRecipient,
  notificationType: WhatsAppNotificationType,
  templateParams: WhatsAppTemplateParams,
  reference?: WhatsAppReference,
): Promise<void> {
  let supabaseAdmin: SupabaseAdmin | undefined;

  try {
    supabaseAdmin = await createServerSupabaseAdmin();

    const { phone, whatsappEnabled } = await resolveRecipientPhone(supabaseAdmin, recipient);

    if (!whatsappEnabled) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: opt-out",
        undefined,
        reference,
      );
      return;
    }

    if (!phone) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: no phone on file",
        undefined,
        reference,
      );
      return;
    }

    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: invalid phone format",
        undefined,
        reference,
      );
      return;
    }

    const template = getWhatsAppTemplate(notificationType, templateParams);

    const { externalMessageId } = await sendWhatsAppTemplateMessage({
      to: normalizedPhone,
      templateName: template.name,
      parameters: template.parameters,
    });

    await logWhatsAppAttempt(
      supabaseAdmin,
      recipient,
      notificationType,
      "sent",
      null,
      externalMessageId,
      reference,
    );
  } catch (err) {
    const reason =
      err instanceof WhatsAppApiError
        ? `${err.code ?? "unknown"}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";

    console.error(
      `[whatsapp] failed to send ${notificationType} to ${recipient.recipientType} ${recipient.recipientId}: ${reason}`,
    );

    if (!supabaseAdmin) {
      console.error(
        `[whatsapp] could not write notification_log row for ${notificationType} to ${recipient.recipientType} ${recipient.recipientId}: failed to construct Supabase admin client`,
      );
      return;
    }

    await logWhatsAppAttempt(
      supabaseAdmin,
      recipient,
      notificationType,
      "failed",
      reason,
      undefined,
      reference,
    );
  }
}

export async function resolveRecipientPhone(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppRecipient,
): Promise<{ phone: string | null; whatsappEnabled: boolean }> {
  if (recipient.recipientType === "patient") {
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("phone, whatsapp_enabled")
      .eq("id", recipient.recipientId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar telefone da paciente: ${error.message}`);

    return { phone: data?.phone ?? null, whatsappEnabled: data?.whatsapp_enabled ?? true };
  }

  if (recipient.recipientType === "invite") {
    // Convites de auto cadastro ainda não têm patients/users associado (ver
    // patient_invite_links) — telefone/e-mail ficam na própria linha do convite, sem
    // conceito de opt-out (a paciente ainda não criou conta nem configurou preferências).
    const { data, error } = await supabaseAdmin
      .from("patient_invite_links")
      .select("phone, used_at, expires_at")
      .eq("id", recipient.recipientId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar telefone do convite: ${error.message}`);
    if (!data || data.used_at || (data.expires_at && new Date(data.expires_at) < new Date())) {
      return { phone: null, whatsappEnabled: true };
    }

    return { phone: data.phone ?? null, whatsappEnabled: true };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("phone, notification_settings(whatsapp_enabled)")
    .eq("id", recipient.recipientId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar telefone do usuário: ${error.message}`);

  const settings = Array.isArray(data?.notification_settings)
    ? data.notification_settings[0]
    : data?.notification_settings;

  return { phone: data?.phone ?? null, whatsappEnabled: settings?.whatsapp_enabled ?? true };
}

async function logWhatsAppAttempt(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppRecipient,
  notificationType: WhatsAppNotificationType,
  status: "sent" | "failed",
  errorReason: string | null,
  externalMessageId?: string,
  reference?: WhatsAppReference,
): Promise<void> {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: notificationType,
    reference_type: reference?.referenceType ?? null,
    reference_id: reference?.referenceId ?? null,
    recipient_type: recipient.recipientType,
    recipient_id: recipient.recipientId,
    status,
    error_reason: errorReason,
    external_message_id: externalMessageId ?? null,
  });

  if (error) {
    console.error("[whatsapp] failed to write notification_log row:", error);
  }
}
