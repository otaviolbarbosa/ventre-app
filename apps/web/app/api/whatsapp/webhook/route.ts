import { updateNotificationLogStatusByExternalId, findNotificationLogByExternalId } from "@/lib/notifications/notification-log";
import { WHATSAPP_INBOUND_BUTTON_HANDLERS } from "@/lib/notifications/whatsapp-inbound-handlers";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/webhook-signature";
import { extractButtonReplies, extractStatusUpdates, whatsappWebhookPayloadSchema } from "@/lib/whatsapp/webhook-schemas";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

// Handshake de verificação do webhook (configurado uma vez no painel da Meta, ver spec seção
// "Passos manuais no Meta Business Platform", item 5).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expectedToken && verifyToken === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verificação inválida" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Segredo ausente é erro de configuração do ambiente, não uma tentativa de ataque — mas o
  // resultado prático é o mesmo: nunca processar sem poder validar a origem.
  if (!appSecret || !verifyWhatsAppSignature(rawBody, signatureHeader, appSecret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const json = JSON.parse(rawBody);
  const parseResult = whatsappWebhookPayloadSchema.safeParse(json);
  if (!parseResult.success) {
    // Assinatura já validada (é a Meta de verdade), mas o formato não bateu com o schema —
    // loga e responde 200 mesmo assim, igual a qualquer outra anomalia de negócio abaixo.
    console.error("[whatsapp-webhook] payload failed schema validation:", parseResult.error.message);
    return NextResponse.json({ received: true });
  }

  const supabaseAdmin = await createServerSupabaseAdmin();
  const payload = parseResult.data;

  for (const statusUpdate of extractStatusUpdates(payload)) {
    if (statusUpdate.status === "sent") continue; // já gravado como "sent" no envio (worker)
    await updateNotificationLogStatusByExternalId(
      supabaseAdmin,
      statusUpdate.messageId,
      statusUpdate.status,
      statusUpdate.errorTitle,
    );
  }

  for (const buttonReply of extractButtonReplies(payload)) {
    const logEntry = await findNotificationLogByExternalId(supabaseAdmin, buttonReply.contextMessageId);
    if (!logEntry) {
      console.error(
        `[whatsapp-webhook] button reply "${buttonReply.buttonPayload}" references unknown message ${buttonReply.contextMessageId}`,
      );
      continue;
    }

    const handler = WHATSAPP_INBOUND_BUTTON_HANDLERS[buttonReply.buttonPayload];
    if (!handler) {
      console.error(`[whatsapp-webhook] no handler registered for button payload "${buttonReply.buttonPayload}"`);
      continue;
    }

    try {
      const result = await handler(supabaseAdmin, logEntry);
      if (!result.handled) {
        console.error(`[whatsapp-webhook] button handler did not apply: ${result.reason}`);
      }
    } catch (err) {
      console.error("[whatsapp-webhook] button handler threw:", err);
    }
  }

  return NextResponse.json({ received: true });
}
