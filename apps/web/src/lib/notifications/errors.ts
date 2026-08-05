// apps/web/src/lib/notifications/errors.ts

export type NotificationErrorClassification = "retryable" | "permanent";

const PERMANENT_PUSH_ERROR_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT"]);

export function classifyPushError(error: { code?: string; message?: string }): NotificationErrorClassification {
  if (error.code && PERMANENT_PUSH_ERROR_CODES.has(error.code)) {
    return "permanent";
  }
  return "retryable";
}
