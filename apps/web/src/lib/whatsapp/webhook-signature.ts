// apps/web/src/lib/whatsapp/webhook-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

// Valida o header X-Hub-Signature-256 que a Meta envia em todo POST de webhook: HMAC-SHA256
// do corpo bruto da requisição (antes de qualquer parse), assinado com o App Secret. Precisa
// ser comparado em tempo constante — uma comparação de string comum (===) vaza timing e
// permite um ataque de força bruta byte a byte contra o segredo.
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const receivedBuffer = Buffer.from(receivedHex, "hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
