import { dayjs } from "@/lib/dayjs";
import { cancelNotificationsForReference, enqueueNotification } from "@/lib/notifications/queue";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Database } from "@ventre/supabase/types";
import { formatCurrency } from "./calculations";

type InstallmentsNotificationType = Database["public"]["Enums"]["installments_notification_type"];

type NotificationMessage = {
  title: string;
  body: string;
};

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
    const rows: Database["public"]["Tables"]["installments_scheduled_notifications"]["Insert"][] =
      [];

    for (const installment of installments) {
      for (const nt of notificationTypes) {
        const scheduledFor = dayjs(installment.due_date)
          .subtract(nt.daysBefore, "day")
          .hour(12)
          .minute(0)
          .second(0);

        if (scheduledFor.isBefore(now)) continue;

        for (const userId of userIds) {
          rows.push({
            installment_id: installment.id,
            user_id: userId,
            type: nt.type,
            scheduled_for: scheduledFor.toISOString(),
          });
        }
      }
    }

    // Legacy insert first, unblocked by any pgmq work: this function is called
    // fire-and-forget (no `await`) by its callers, so anything placed before this insert
    // delays/risks the legacy write on a serverless runtime that may freeze/reclaim the
    // detached promise once the HTTP response is sent.
    if (rows.length > 0) {
      await supabaseAdmin.from("installments_scheduled_notifications").insert(rows);
    }

    // pgmq enqueues are strictly additive/best-effort and run after the legacy insert
    // above, so a slow or failing pgmq call can never delay or endanger the legacy write.
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
            // Note: enqueue_notification's ON CONFLICT ... DO UPDATE SET msg_id = EXCLUDED.msg_id
            // replaces the index pointer on a repeat call with the same dedup key, but does NOT
            // delete the previously-queued pgmq message it's replacing — so if
            // scheduleBillingNotifications is ever called twice for the same installment (e.g. a
            // future "edit billing" flow), each re-run can leave an orphaned, uncancellable
            // duplicate message in the queue. Not a bug today (both current callers are
            // creation-only paths), just a known sharp edge for whoever touches this next.
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
    const supabaseAdmin = await createServerSupabaseAdmin();
    await supabaseAdmin
      .from("installments_scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("installment_id", installmentId)
      .eq("status", "pending");
  } catch {
    console.error(
      "[billing-notifications] Failed to cancel notifications for installment:",
      installmentId,
    );
  }

  try {
    // cancel_notifications_for_reference filters only by (reference_type, reference_id) —
    // not by queue_name or notification_type — so this cancels pending messages across ALL
    // queues/notification types for this installment: not just the billing_reminder push
    // enqueued above, but also the Phase-3 WhatsApp installment reminders
    // (installment_payment_reminder / installment_under_review_stalled /
    // installment_overdue_professional), which also key off reference_type = "installment".
    // This is intentional and desired here: a paid/cancelled installment shouldn't receive
    // WhatsApp reminders either, and none will be re-enqueued for it.
    await cancelNotificationsForReference("installment", installmentId);
  } catch (err) {
    console.error(
      "[billing-notifications] Failed to cancel pgmq push notifications for installment:",
      installmentId,
      err,
    );
  }
}

export function getBillingNotificationMessage(
  type: InstallmentsNotificationType,
  amount: number,
  dueDate: string,
  description: string,
): NotificationMessage {
  const formattedAmount = formatCurrency(amount);
  const formattedDate = dayjs(dueDate).format("DD/MM/YYYY");

  const messages: Record<InstallmentsNotificationType, NotificationMessage> = {
    due_in_7_days: {
      title: "Vencimento em 7 dias",
      body: `Parcela de ${formattedAmount} (${description}) vence em ${formattedDate}.`,
    },
    due_in_3_days: {
      title: "Vencimento em 3 dias",
      body: `Parcela de ${formattedAmount} (${description}) vence em ${formattedDate}.`,
    },
    due_today: {
      title: "Parcela vence hoje",
      body: `Parcela de ${formattedAmount} (${description}) vence hoje (${formattedDate}).`,
    },
    overdue: {
      title: "Parcela em atraso",
      body: `Parcela de ${formattedAmount} (${description}) venceu em ${formattedDate}.`,
    },
  };

  return messages[type];
}
