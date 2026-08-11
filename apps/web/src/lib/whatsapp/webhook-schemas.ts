// apps/web/src/lib/whatsapp/webhook-schemas.ts
import { z } from "zod";

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});

const buttonMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.literal("button"),
  context: z.object({ id: z.string() }).optional(),
  button: z.object({ text: z.string(), payload: z.string() }),
});

// A Meta manda outros tipos de mensagem (text, image, interactive, etc.) no mesmo array —
// este schema aceita qualquer objeto com "type" e ignora o que não for "button" na extração.
const inboundMessageSchema = z.union([
  buttonMessageSchema,
  z.object({ id: z.string(), from: z.string(), timestamp: z.string(), type: z.string() }).passthrough(),
]);

const changeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  statuses: z.array(statusSchema).optional(),
  messages: z.array(inboundMessageSchema).optional(),
});

const changeSchema = z.object({
  field: z.string(),
  value: changeValueSchema,
});

const entrySchema = z.object({
  id: z.string(),
  changes: z.array(changeSchema),
});

export const whatsappWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(entrySchema),
});

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>;

export type WhatsAppStatusUpdate = {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorTitle?: string;
};

export type WhatsAppButtonReply = {
  contextMessageId: string;
  buttonPayload: string;
};

export function extractStatusUpdates(payload: WhatsAppWebhookPayload): WhatsAppStatusUpdate[] {
  const updates: WhatsAppStatusUpdate[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      for (const status of change.value.statuses ?? []) {
        updates.push({
          messageId: status.id,
          status: status.status,
          errorTitle: status.errors?.[0]?.title,
        });
      }
    }
  }
  return updates;
}

function isButtonMessage(
  message: z.infer<typeof inboundMessageSchema>,
): message is z.infer<typeof buttonMessageSchema> {
  return message.type === "button" && "button" in message;
}

export function extractButtonReplies(payload: WhatsAppWebhookPayload): WhatsAppButtonReply[] {
  const replies: WhatsAppButtonReply[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        if (!isButtonMessage(message) || !message.context) continue;
        replies.push({ contextMessageId: message.context.id, buttonPayload: message.button.payload });
      }
    }
  }
  return replies;
}
