import { SeverityNumber } from "@opentelemetry/api-logs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loggerProvider } from "../../instrumentation";

const logger = loggerProvider?.getLogger("nascere-web");

type ActionType =
  | "appointment"
  | "patient"
  | "team"
  | "clinical"
  | "exam"
  | "vaccine"
  | "billing"
  | "enterprise";

type InsertActivityLogParams = {
  supabaseAdmin: SupabaseClient;
  actionName: string;
  description: string;
  actionType: ActionType;
  userId: string;
  enterpriseId: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertActivityLog({
  supabaseAdmin,
  actionName,
  description,
  actionType,
  userId,
  enterpriseId,
  patientId,
  metadata = {},
}: InsertActivityLogParams): Promise<void> {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    action_name: actionName,
    description,
    action_type: actionType,
    user_id: userId,
    enterprise_id: enterpriseId,
    patient_id: patientId ?? null,
    metadata,
  });

  if (error) {
    console.error("[insertActivityLog]", error.message);
    logger?.emit({
      body: `Failed to insert activity log: ${actionName}`,
      severityNumber: SeverityNumber.ERROR,
      attributes: {
        actionName,
        actionType,
        userId,
        enterpriseId,
        patientId: patientId ?? null,
        error: error.message,
      },
    });
    // failure never propagates — logging is observability only
    return;
  }

  logger?.emit({
    body: description,
    severityNumber: SeverityNumber.INFO,
    attributes: {
      actionName,
      actionType,
      userId,
      enterpriseId,
      patientId: patientId ?? null,
      ...metadata,
    },
  });
}
