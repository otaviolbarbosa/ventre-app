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

    for (const notification of notifications ?? []) {
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

      // Check billing notification preferences
      const { data: prefs } = await supabaseAdmin
        .from("billing_notification_preferences")
        .select("enable_billing_reminders")
        .eq("user_id", notification.user_id)
        .single();

      if (prefs && !prefs.enable_billing_reminders) {
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
