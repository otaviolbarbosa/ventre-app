const META_GRAPH_API_VERSION = "v21.0";

export class WhatsAppApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
  }
}

export async function sendWhatsAppTemplateMessage(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters: string[];
}): Promise<{ externalMessageId: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN;

  if (!phoneNumberId || !token) {
    throw new WhatsAppApiError("WhatsApp credentials not configured", "not_configured");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode ?? "pt_BR" },
            components: [
              {
                type: "body",
                parameters: params.parameters.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new WhatsAppApiError(message, "network_error");
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorCode = json?.error?.code !== undefined ? String(json.error.code) : undefined;
    const errorMessage = json?.error?.message ?? `WhatsApp API request failed (${response.status})`;
    throw new WhatsAppApiError(errorMessage, errorCode);
  }

  const externalMessageId = json?.messages?.[0]?.id;
  if (!externalMessageId) {
    throw new WhatsAppApiError("WhatsApp API response missing message id");
  }

  return { externalMessageId };
}
