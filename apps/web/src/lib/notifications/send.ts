import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import { sendMulticastNotification } from "@/lib/firebase/admin";

export type NotificationType =
  | "appointment_created"
  | "appointment_updated"
  | "appointment_cancelled"
  | "appointment_reminder"
  | "team_invite_received"
  | "team_invite_accepted"
  | "document_uploaded"
  | "evolution_added"
  | "dpp_approaching"
  | "billing_created"
  | "billing_payment_received"
  | "billing_reminder";

type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendNotificationToUser(userId: string, payload: NotificationPayload) {
  try {
    const supabaseAdmin = await createServerSupabaseAdmin();

    // Check user's notification settings
    const { data: settings } = await supabaseAdmin
      .from("notification_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settings) {
      const settingKey = payload.type as keyof typeof settings;
      if (settings[settingKey] === false) return;
    }

    // Check billing-specific notification preferences
    const billingTypes = ["billing_created", "billing_payment_received", "billing_reminder"];
    if (billingTypes.includes(payload.type)) {
      const { data: billingPrefs } = await supabaseAdmin
        .from("billing_notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (billingPrefs) {
        if (payload.type === "billing_reminder" && !billingPrefs.enable_billing_reminders) return;
        if (payload.type === "billing_payment_received" && !billingPrefs.enable_payment_confirmations) return;
      }
    }

    // Get active push tokens
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    const tokens = subscriptions?.map((s) => s.fcm_token) ?? [];

    // Send push notification
    if (tokens.length > 0) {
      const result = await sendMulticastNotification(tokens, {
        title: payload.title,
        body: payload.body,
        data: { ...payload.data, type: payload.type },
      });

      // Deactivate invalid tokens
      if (result.invalidTokens.length > 0) {
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ is_active: false })
          .in("fcm_token", result.invalidTokens);
      }
    }

    // Store in notification history
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    });
  } catch {
    // Fire-and-forget: don't throw
    console.error("[notifications] Failed to send notification to user:", userId);
  }
}

export async function sendNotificationToTeam(
  patientId: string,
  excludeUserId: string | null,
  payload: NotificationPayload,
) {
  try {
    const supabaseAdmin = await createServerSupabaseAdmin();

    // Get all team members for this patient
    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("professional_id")
      .eq("patient_id", patientId);

    // Also get the patient's own user_id
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("user_id")
      .eq("id", patientId)
      .single();

    const userIds = new Set<string>();

    for (const member of teamMembers ?? []) {
      if (member.professional_id !== excludeUserId) {
        userIds.add(member.professional_id);
      }
    }

    if (patient?.user_id && patient.user_id !== excludeUserId) {
      userIds.add(patient.user_id);
    }

    // Send to each user (fire-and-forget)
    const promises = Array.from(userIds).map((userId) => sendNotificationToUser(userId, payload));
    await Promise.allSettled(promises);
  } catch {
    console.error("[notifications] Failed to send team notification for patient:", patientId);
  }
}
