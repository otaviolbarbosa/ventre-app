"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseProfessionals } from "@/services/professional";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid().optional(),
});

export const getEnterpriseProfessionalsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const { professionals } = await getEnterpriseProfessionals(parsedInput.patientId);
    return { professionals };
  });
