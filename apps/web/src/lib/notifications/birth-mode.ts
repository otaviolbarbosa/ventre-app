import { enqueueNotification } from "@/lib/notifications/queue";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export async function scheduleBirthModeActivationNotifications(pregnancyId: string) {
  try {
    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: pregnancy } = await supabaseAdmin
      .from("pregnancies")
      .select("patient_id")
      .eq("id", pregnancyId)
      .single();

    if (!pregnancy) return;

    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("professional_id")
      .eq("patient_id", pregnancy.patient_id);

    if (!teamMembers?.length) return;

    for (const tm of teamMembers) {
      try {
        await enqueueNotification({
          queueName: "whatsapp_notifications",
          notificationType: "birth_mode_activated",
          referenceType: "pregnancy",
          referenceId: pregnancyId,
          recipientType: "user",
          recipientId: tm.professional_id,
          dedupKey: `birth_mode_activated_${pregnancyId}_${tm.professional_id}`,
        });
      } catch (err) {
        console.error(
          "[birth-mode-notifications] Failed to enqueue whatsapp notification for pregnancy:",
          pregnancyId,
          "user:",
          tm.professional_id,
          err,
        );
      }
    }
  } catch {
    console.error(
      "[birth-mode-notifications] Failed to schedule notifications for pregnancy:",
      pregnancyId,
    );
  }
}
