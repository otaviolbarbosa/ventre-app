import { classifyPushError } from "@/lib/notifications/errors";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import {
  ackNotification,
  deadLetterNotification,
  dequeueNotifications,
  requeueWithBackoff,
  type DequeuedNotification,
} from "@/lib/notifications/queue";
import { type NotificationType, sendNotificationToUser } from "@/lib/notifications/send";
import { dayjs } from "@/lib/dayjs";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 5;

type ResolvedPushNotification = {
  type: NotificationType;
  userId: string;
  title: string;
  body: string;
  url: string;
};

async function resolvePushRecipientAndTemplate(
  notification: DequeuedNotification,
  supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
): Promise<ResolvedPushNotification | null> {
  if (notification.notificationType === "appointment_reminder") {
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .select("*, patient:patients!appointments_patient_id_fkey(id, name, user_id)")
      .eq("id", notification.referenceId)
      .maybeSingle();

    if (appointmentError) {
      throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${appointmentError.message}`);
    }

    if (!appointment || appointment.status !== "agendada") return null;

    const patient = appointment.patient as unknown as { name: string; user_id: string | null };
    if (!patient.user_id) return null;

    const template = getNotificationTemplate("appointment_reminder", {
      patientName: patient.name,
      date: appointment.date,
      time: appointment.time,
    });

    return {
      type: "appointment_reminder",
      userId: patient.user_id,
      title: template.title,
      body: template.body,
      url: `/patients/${appointment.patient_id}`,
    };
  }

  if (notification.notificationType === "dpp_approaching") {
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id, name, user_id")
      .eq("id", notification.referenceId)
      .maybeSingle();

    if (patientError) {
      throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${patientError.message}`);
    }

    if (!patient?.user_id) return null;

    // Mesmo padrão de schedule_dpp_reminders(): gestação ativa mais recente (não finalizada).
    const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
      .from("pregnancies")
      .select("due_date")
      .eq("patient_id", patient.id)
      .eq("has_finished", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pregnancyError) {
      throw new Error(`Falha ao buscar gestação de ${patient.id}: ${pregnancyError.message}`);
    }

    if (!pregnancy?.due_date) return null;

    const daysUntilDpp = dayjs(pregnancy.due_date).startOf("day").diff(dayjs().startOf("day"), "day");

    const template = getNotificationTemplate("dpp_approaching", {
      patientName: patient.name,
      daysUntilDpp,
    });

    return {
      type: "dpp_approaching",
      userId: patient.user_id,
      title: template.title,
      body: template.body,
      url: `/patients/${patient.id}`,
    };
  }

  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  let pushSent = 0;
  let pushSkipped = 0;
  let pushFailed = 0;

  const pushMessages = await dequeueNotifications("push_notifications", 20, 60);

  for (const notification of pushMessages) {
    try {
      const resolved = await resolvePushRecipientAndTemplate(notification, supabaseAdmin);

      if (!resolved) {
        // referência não existe mais ou não é mais válida (ex: consulta cancelada) — descarta
        await ackNotification("push_notifications", notification.msgId);
        pushSkipped++;
        continue;
      }

      await sendNotificationToUser(resolved.userId, {
        type: resolved.type,
        title: resolved.title,
        body: resolved.body,
        data: { url: resolved.url },
      });

      await supabaseAdmin.from("notification_log").insert({
        channel: "push",
        notification_type: notification.notificationType,
        reference_type: notification.referenceType,
        reference_id: notification.referenceId,
        recipient_type: notification.recipientType,
        recipient_id: notification.recipientId,
        status: "sent",
      });

      await ackNotification("push_notifications", notification.msgId);
      pushSent++;
    } catch (err) {
      const classification = classifyPushError(err as { code?: string; message?: string });

      if (classification === "permanent" || notification.readCt >= MAX_ATTEMPTS) {
        await deadLetterNotification({
          queueName: "push_notifications",
          msgId: notification.msgId,
          channel: "push",
          notificationType: notification.notificationType,
          referenceType: notification.referenceType,
          referenceId: notification.referenceId,
          recipientType: notification.recipientType,
          recipientId: notification.recipientId,
          reason: err instanceof Error ? err.message : "unknown error",
        });
      } else {
        await requeueWithBackoff("push_notifications", notification.msgId, notification.readCt);
      }
      pushFailed++;
    }
  }

  // Fase 1: fila de whatsapp existe mas ainda não tem remetente — só confirma que está vazia/acessível.
  const whatsappMessages = await dequeueNotifications("whatsapp_notifications", 1, 1);

  return NextResponse.json({
    push: { sent: pushSent, skipped: pushSkipped, failed: pushFailed },
    whatsapp: { pending: whatsappMessages.length },
  });
}
