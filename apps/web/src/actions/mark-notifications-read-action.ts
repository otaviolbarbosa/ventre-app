"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { markNotificationsRead } from "@/services/notification";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export const markNotificationsReadAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    await markNotificationsRead(supabase, user.id, parsedInput.ids);

    await captureServerEvent(user.id, "mark_notifications_read", {});

    return { success: true };
  });
