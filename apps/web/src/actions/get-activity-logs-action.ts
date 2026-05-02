"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { z } from "zod";

export const getActivityLogsAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx: { supabaseAdmin, profile } }) => {
    if (!profile.enterprise_id) return { logs: [], total: 0 };
    return await getEnterpriseActivityLogs(supabaseAdmin, profile.enterprise_id, { limit: 10 });
  });
