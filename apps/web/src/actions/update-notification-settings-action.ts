"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { notificationSettingsSchema } from "@/lib/validations/notification-settings";
import { updateNotificationSettings } from "@/services/notification";

export const updateNotificationSettingsAction = authActionClient
  .inputSchema(notificationSettingsSchema.partial())
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const settings = await updateNotificationSettings(supabase, user.id, parsedInput);

    await captureServerEvent(user.id, "update_notification_settings", {});

    return { settings };
  });
