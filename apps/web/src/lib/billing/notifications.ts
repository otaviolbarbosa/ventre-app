import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import type { Database } from "@nascere/supabase/types";
import { dayjs } from "@/lib/dayjs";
import { formatCurrency } from "./calculations";

type InstallmentsNotificationType =
  Database["public"]["Enums"]["installments_notification_type"];

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

    if (rows.length > 0) {
      await supabaseAdmin
        .from("installments_scheduled_notifications")
        .insert(rows);
    }
  } catch {
    console.error("[billing-notifications] Failed to schedule notifications for billing:", billingId);
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
    console.error("[billing-notifications] Failed to cancel notifications for installment:", installmentId);
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
