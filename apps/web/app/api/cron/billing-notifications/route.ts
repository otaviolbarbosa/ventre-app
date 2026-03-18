import { NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import { getBillingNotificationMessage } from "@/lib/billing/notifications";
import { sendNotificationToUser } from "@/lib/notifications/send";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();
    const now = new Date().toISOString();

    // Get pending notifications where scheduled_for <= now
    const { data: notifications, error } = await supabaseAdmin
      .from("installments_scheduled_notifications")
      .select(`
        *,
        installment:installments!installments_scheduled_notifications_installment_id_fkey(
          id, amount, due_date, status,
          billing:billings!installments_billing_id_fkey(
            description, patient_id
          )
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let sent = 0;
    let skipped = 0;

    const notificationList = notifications ?? [];

    // Batch-fetch all preferences in a single query to avoid N+1
    const userIds = [...new Set(notificationList.map((n) => n.user_id))];
    const { data: allPrefs } = await supabaseAdmin
      .from("billing_notification_preferences")
      .select("user_id, enable_billing_reminders")
      .in("user_id", userIds);

    const prefsMap = new Map(
      (allPrefs ?? []).map((p) => [p.user_id, p.enable_billing_reminders]),
    );

    for (const notification of notificationList) {
      const installment = notification.installment as unknown as {
        id: string;
        amount: number;
        due_date: string;
        status: string;
        billing: { description: string; patient_id: string };
      };

      // Skip if installment is already paid or cancelled
      if (
        !installment ||
        installment.status === "pago" ||
        installment.status === "cancelado"
      ) {
        await supabaseAdmin
          .from("installments_scheduled_notifications")
          .update({ status: "cancelled" })
          .eq("id", notification.id);
        skipped++;
        continue;
      }

      // Check billing notification preferences (from pre-fetched map)
      const enableReminders = prefsMap.get(notification.user_id);
      if (enableReminders === false) {
        await supabaseAdmin
          .from("installments_scheduled_notifications")
          .update({ status: "cancelled" })
          .eq("id", notification.id);
        skipped++;
        continue;
      }

      const message = getBillingNotificationMessage(
        notification.type,
        installment.amount,
        installment.due_date,
        installment.billing.description,
      );

      try {
        await sendNotificationToUser(notification.user_id, {
          type: "billing_reminder",
          title: message.title,
          body: message.body,
          data: {
            url: `/patients/${installment.billing.patient_id}/billing`,
          },
        });

        await supabaseAdmin
          .from("installments_scheduled_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notification.id);
        sent++;
      } catch {
        await supabaseAdmin
          .from("installments_scheduled_notifications")
          .update({ status: "failed" })
          .eq("id", notification.id);
      }
    }

    return NextResponse.json({ sent, skipped });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
