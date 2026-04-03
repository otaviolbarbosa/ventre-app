"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseBillings } from "@/services/billing";
import { z } from "zod";

export type { EnterpriseBillingProfessional } from "@/services/billing";

const schema = z.object({
  professionalId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getEnterpriseBillingAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { profile } }) => {
    const { professionalId, startDate, endDate } = parsedInput;

    if (!profile.enterprise_id) {
      return { billings: [], metrics: null, professionals: [] };
    }

    return getEnterpriseBillings(profile.enterprise_id, startDate, endDate, professionalId);
  });
