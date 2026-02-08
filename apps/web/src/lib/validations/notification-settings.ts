import { z } from "zod";

export const notificationSettingsSchema = z.object({
  appointment_created: z.boolean(),
  appointment_updated: z.boolean(),
  appointment_cancelled: z.boolean(),
  appointment_reminder: z.boolean(),
  team_invite_received: z.boolean(),
  team_invite_accepted: z.boolean(),
  document_uploaded: z.boolean(),
  evolution_added: z.boolean(),
  dpp_approaching: z.boolean(),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
