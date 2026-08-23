"use server";

import type { BirthEventType } from "@/lib/birth-mode-constants";
import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
});

export type BirthModeTimelineEvent = {
  type: BirthEventType;
  id: string;
  occurredAt: string;
  professionalId: string | null;
  professionalName: string;
  payload: Record<string, unknown>;
};

export const getBirthModeTimelineAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    return fetchBirthModeTimelineData(supabase, parsedInput.pregnancyId);
  });
