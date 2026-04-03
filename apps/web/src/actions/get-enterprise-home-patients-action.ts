"use server";
import { authActionClient } from "@/lib/safe-action";
import { getCachedEnterpriseHomePatients } from "@/services/enterprise-home-patients-cache";
import type { PatientFilter } from "@/types";
import { z } from "zod";

const schema = z.object({
  filter: z.enum(["all", "recent", "trim1", "trim2", "trim3", "final"]).default("all"),
  search: z.string().default(""),
  professionalId: z.string().optional(),
  dppMonth: z.number().optional(),
  dppYear: z.number().optional(),
});

export const getEnterpriseHomePatientsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { profile } }) => {
    if (!profile.enterprise_id) {
      return { items: [] };
    }

    const items = await getCachedEnterpriseHomePatients({
      enterpriseId: profile.enterprise_id,
      professionalId: parsedInput.professionalId,
      filter: parsedInput.filter as PatientFilter,
      search: parsedInput.search,
      dppMonth: parsedInput.dppMonth,
      dppYear: parsedInput.dppYear,
    });

    return { items };
  });
