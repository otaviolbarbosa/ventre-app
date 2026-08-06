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
