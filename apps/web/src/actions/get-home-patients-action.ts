"use server";

import { authActionClient } from "@/lib/safe-action";
import { getCachedHomePatients } from "@/services/home-patients-cache";
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
    const { filter, search, showFinished, dppMonth, dppYear } = parsedInput;

    const patients = await getCachedHomePatients(
      user.id,
      filter,
      search,
      showFinished,
      dppMonth,
      dppYear,
    );

    return { patients };
  });
