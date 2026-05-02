"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { z } from "zod";

const PAGE_SIZE = 20;

const schema = z.object({
  page: z.number().int().min(1).default(1),
});

export const getActivityLogsPaginatedAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!profile.enterprise_id) return { logs: [], total: 0, page: 1, totalPages: 0 };

    const offset = (parsedInput.page - 1) * PAGE_SIZE;
    const { logs, total } = await getEnterpriseActivityLogs(supabaseAdmin, profile.enterprise_id, {
      limit: PAGE_SIZE,
      offset,
    });

    return {
      logs,
      total,
      page: parsedInput.page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  });
