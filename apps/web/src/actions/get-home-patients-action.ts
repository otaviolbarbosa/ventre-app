"use server";

import { authActionClient } from "@/lib/safe-action";
import { getCachedHomePatients } from "@/services/home-patients-cache";
import type { PatientFilter } from "@/types";
import { z } from "zod";

const schema = z.object({
  filter: z.enum(["all", "recent", "trim1", "trim2", "trim3", "final"]).default("all"),
  showFinished: z.boolean().optional().default(false),
  search: z.string().default(""),
  dppMonth: z.number().optional(),
  dppYear: z.number().optional(),
});

export const getHomePatientsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    console.log("###", parsedInput);
    const items = await getCachedHomePatients({
      userId: user.id,
      filter: parsedInput.filter as PatientFilter,
      showFinished: parsedInput.showFinished,
      search: parsedInput.search,
      dppMonth: parsedInput.dppMonth,
      dppYear: parsedInput.dppYear,
    });

    return { items };
  });
