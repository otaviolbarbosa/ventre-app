"use server";

import { authActionClient } from "@/lib/safe-action";
import { getCachedEnterprisePatients } from "@/services/enterprise-patients-cache";
import type { PatientWithGestationalInfo, TeamMember } from "@/types";
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
    const { filter, search, professionalId, dppMonth, dppYear } = parsedInput;

    if (!profile.enterprise_id) {
      return { items: [] as { patient: PatientWithGestationalInfo; teamMembers: TeamMember[] }[] };
    }

    const items = await getCachedEnterprisePatients(
      profile.enterprise_id,
      filter,
      search,
      professionalId,
      dppMonth,
      dppYear,
    );

    return { items };
  });
