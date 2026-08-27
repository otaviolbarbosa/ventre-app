// apps/web/src/lib/notifications/errors.ts

export type NotificationErrorClassification = "retryable" | "permanent";

// Error codes from the firebase-admin SDK's messaging module (admin.messaging().send /
// sendEachForMulticast) — NOT the FCM v1 REST API codes ("UNREGISTERED",
// "INVALID_ARGUMENT" etc, which use SCREAMING_SNAKE_CASE and only apply to the Deno Edge
// Functions' direct REST calls). This worker's real send path goes through
// sendNotificationToUser -> sendMulticastNotification (apps/web/src/lib/firebase/admin.ts),
// which uses firebase-admin and throws/reports errors with "messaging/..." style codes.
// See: https://firebase.google.com/docs/reference/admin/error-handling#messaging
const PERMANENT_PUSH_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
  "messaging/mismatched-credential",
  "messaging/invalid-package-name",
]);

export function classifyPushError(error: {
  code?: string;
  message?: string;
}): NotificationErrorClassification {
  if (error.code && PERMANENT_PUSH_ERROR_CODES.has(error.code)) {
    return "permanent";
  }
  return "retryable";
}

// Códigos de erro da Meta Cloud API (WhatsApp Business Platform). Ver seção "Classificação de
// erro da Meta" da spec: 131030/131026 = dado do destinatário (permanente), 132001/131009 =
// configuração de template (permanente), "not_configured" = credenciais ausentes (permanente,
// nunca deve ser retentado — é erro de configuração do ambiente, não de mensagem individual).
const PERMANENT_WHATSAPP_ERROR_CODES = new Set([
  "131030",
  "131026",
  "132001",
  "131009",
  "not_configured",
]);

export function classifyWhatsAppError(error: {
  code?: string;
  message?: string;
}): NotificationErrorClassification {
  if (error.code && PERMANENT_WHATSAPP_ERROR_CODES.has(error.code)) {
    return "permanent";
  }
  return "retryable";
}

// sendPatientInvite (Resend) só expõe uma mensagem genérica hoje, sem código estruturado —
// tudo é tratado como retryable até MAX_ATTEMPTS, quando cai em dead-letter pelo mesmo
// caminho usado por push/whatsapp.
export function classifyEmailError(_error: {
  code?: string;
  message?: string;
}): NotificationErrorClassification {
  return "retryable";
}
