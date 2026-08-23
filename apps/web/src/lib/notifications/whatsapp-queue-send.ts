import { resolveRecipientPhone } from "@/lib/notifications/whatsapp-send";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp/client";
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type WhatsAppQueueRecipient = {
  recipientType: "patient" | "user" | "invite";
  recipientId: string;
};

export type WhatsAppQueueSendResult =
  | { outcome: "sent"; externalMessageId: string }
  | { outcome: "skipped"; reason: string };

type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

// Irmã de sendWhatsAppToUser (lib/notifications/whatsapp-send.ts) para uso exclusivo do worker
// de fila: mesma resolução de destinatário/opt-out/telefone/template, mas LANÇA em falha real da
// API da Meta em vez de engolir — o worker precisa do erro para classificar retry vs.
// dead-letter (ver lib/notifications/errors.ts:classifyWhatsAppError).
export async function sendWhatsAppTemplateFromQueue(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppQueueRecipient,
  notificationType: WhatsAppNotificationType,
  templateParams: WhatsAppTemplateParams,
): Promise<WhatsAppQueueSendResult> {
  const { phone, whatsappEnabled } = await resolveRecipientPhone(supabaseAdmin, recipient);

  if (!whatsappEnabled) {
    return { outcome: "skipped", reason: "skipped: opt-out" };
  }

  if (!phone) {
    return { outcome: "skipped", reason: "skipped: no phone on file" };
  }

  const normalizedPhone = normalizePhoneToE164(phone);
  if (!normalizedPhone) {
    return { outcome: "skipped", reason: "skipped: invalid phone format" };
  }

  const template = getWhatsAppTemplate(notificationType, templateParams);

  const { externalMessageId } = await sendWhatsAppTemplateMessage({
    to: normalizedPhone,
    templateName: template.name,
    parameters: template.parameters,
    buttonParameter: template.buttonParameter,
  });

  return { outcome: "sent", externalMessageId };
}
