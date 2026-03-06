"use server";

import { authActionClient } from "@/lib/safe-action";
import type { Json } from "@nascere/supabase/types";
import { z } from "zod";

const schema = z.object({
  fcmToken: z.string().min(1, "Token FCM obrigatório"),
  deviceInfo: z.record(z.unknown()).optional(),
});

export const subscribeNotificationsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user } }) => {
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        fcm_token: parsedInput.fcmToken,
        device_info: (parsedInput.deviceInfo ?? {}) as Json,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fcm_token" },
    );

    if (error) throw new Error(error.message);

    return { success: true };
  });
