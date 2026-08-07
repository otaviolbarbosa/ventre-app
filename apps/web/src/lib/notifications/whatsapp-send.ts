import { sendWhatsAppTemplateMessage, WhatsAppApiError } from "@/lib/whatsapp/client";
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type WhatsAppRecipient =
  | { recipientType: "patient"; recipientId: string }
  | { recipientType: "user"; recipientId: string };

type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function sendWhatsAppToUser(
  recipient: WhatsAppRecipient,
  notificationType: WhatsAppNotificationType,
  templateParams: WhatsAppTemplateParams,
): Promise<void> {
  let supabaseAdmin: SupabaseAdmin | undefined;

  try {
    supabaseAdmin = await createServerSupabaseAdmin();

    const { phone, whatsappEnabled } = await resolveRecipientPhone(supabaseAdmin, recipient);

    if (!whatsappEnabled) {
      await logWhatsAppAttempt(supabaseAdmin, recipient, notificationType, "failed", "skipped: opt-out");
      return;
    }

    if (!phone) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: no phone on file",
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

    await logWhatsAppAttempt(supabaseAdmin, recipient, notificationType, "failed", reason);
  }
}

async function resolveRecipientPhone(
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
): Promise<void> {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: notificationType,
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
