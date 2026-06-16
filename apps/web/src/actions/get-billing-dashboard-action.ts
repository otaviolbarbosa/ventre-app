"use server";

import { authActionClient } from "@/lib/safe-action";
import { getBillings, getDashboardMetrics } from "@/services/billing";
import { z } from "zod";

const schema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getBillingDashboardAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const { startDate, endDate } = parsedInput;

    const [{ billings }, { metrics }] = await Promise.all([
      getBillings(startDate, endDate),
      getDashboardMetrics(startDate, endDate),
    ]);

    return { billings, metrics };
  });
