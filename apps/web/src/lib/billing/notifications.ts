import { dayjs } from "@/lib/dayjs";
import { cancelNotificationsForReference, enqueueNotification } from "@/lib/notifications/queue";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

type InstallmentsNotificationType = "due_in_7_days" | "due_in_3_days" | "due_today";

const notificationTypes: {
  type: InstallmentsNotificationType;
  daysBefore: number;
}[] = [
  { type: "due_in_7_days", daysBefore: 7 },
  { type: "due_in_3_days", daysBefore: 3 },
  { type: "due_today", daysBefore: 0 },
];

export async function scheduleBillingNotifications(billingId: string) {
  try {
    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: billing } = await supabaseAdmin
      .from("billings")
      .select(`
        id,
        description,
        patient_id,
        patients!billings_patient_id_fkey(user_id)
      `)
      .eq("id", billingId)
      .single();

    if (!billing) return;

    const { data: installments } = await supabaseAdmin
      .from("installments")
      .select("id, due_date, amount")
      .eq("billing_id", billingId);

    if (!installments?.length) return;

    const patient = billing.patients as unknown as { user_id: string | null };

    // Get team member IDs for this patient
    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("professional_id")
      .eq("patient_id", billing.patient_id);

    const userIds: string[] = [];
    for (const tm of teamMembers ?? []) {
      userIds.push(tm.professional_id);
    }
    if (patient?.user_id) {
      userIds.push(patient.user_id);
    }

    if (userIds.length === 0) return;

    const now = dayjs();

    for (const installment of installments) {
      for (const nt of notificationTypes) {
        const scheduledFor = dayjs(installment.due_date)
          .subtract(nt.daysBefore, "day")
          .hour(12)
          .minute(0)
          .second(0);

        if (scheduledFor.isBefore(now)) continue;

        for (const userId of userIds) {
          try {
            await enqueueNotification({
              queueName: "push_notifications",
              notificationType: "billing_reminder",
              referenceType: "installment",
              referenceId: installment.id,
              recipientType: "user",
              recipientId: userId,
              delaySeconds: Math.max(scheduledFor.diff(now, "second"), 0),
              dedupKey: `${nt.type}_${userId}`,
            });
          } catch (err) {
            console.error(
              "[billing-notifications] Failed to enqueue pgmq push notification for installment:",
              installment.id,
              "user:",
              userId,
              err,
            );
          }
        }
      }
    }
  } catch {
    console.error(
      "[billing-notifications] Failed to schedule notifications for billing:",
      billingId,
    );
  }
}

export async function cancelInstallmentNotifications(installmentId: string) {
  try {
    // cancel_notifications_for_reference filtra só por (reference_type, reference_id) — não
    // por queue_name ou notification_type — então cancela mensagens pendentes em TODAS as
    // filas/tipos desta parcela: não só o billing_reminder de push, mas também os lembretes
    // WhatsApp da Fase 3 (installment_payment_reminder / installment_under_review_stalled /
    // installment_overdue_professional), que também usam reference_type = "installment".
    // Intencional: uma parcela paga/cancelada não deve receber lembrete em nenhum canal.
    await cancelNotificationsForReference("installment", installmentId);
  } catch (err) {
    console.error(
      "[billing-notifications] Failed to cancel pgmq notifications for installment:",
      installmentId,
      err,
    );
  }
}
