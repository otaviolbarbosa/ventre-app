import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityLog = {
  id: string;
  action_name: string;
  description: string;
  action_type: string;
  user: { id: string; name: string } | null;
  user_id: string;
  patient_id: string | null;
  enterprise_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function getEnterpriseActivityLogs(
  supabaseAdmin: SupabaseClient,
  enterpriseId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ logs: ActivityLog[]; total: number }> {
  const { limit = 10, offset = 0 } = options;

  const [logsResult, countResult] = await Promise.all([
    supabaseAdmin
      .from("activity_logs")
      .select(
        "id, action_name, description, action_type, user_id, patient_id, enterprise_id, created_at, metadata, user:users!activity_logs_user_id_fkey(id, name)",
      )
      .eq("enterprise_id", enterpriseId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),

    supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .eq("enterprise_id", enterpriseId),
  ]);

  if (logsResult.error) throw new Error(logsResult.error.message);

  return {
    logs: logsResult.data as unknown as ActivityLog[],
    total: countResult.count ?? 0,
  };
}
