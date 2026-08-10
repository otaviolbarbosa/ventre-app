import { classifyPushError, classifyWhatsAppError } from "@/lib/notifications/errors";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import {
  ackNotification,
  deadLetterNotification,
  dequeueNotifications,
  requeueWithBackoff,
  type DequeuedNotification,
} from "@/lib/notifications/queue";
import { type NotificationType, sendNotificationToUser } from "@/lib/notifications/send";
import { WHATSAPP_QUEUE_HANDLERS } from "@/lib/notifications/whatsapp-queue-handlers";
import { sendWhatsAppTemplateFromQueue } from "@/lib/notifications/whatsapp-queue-send";
import { WhatsAppApiError } from "@/lib/whatsapp/client";
import type { WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { dayjs } from "@/lib/dayjs";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_ATTEMPTS = 5;

// Segura por padrão: qualquer valor diferente de "false" (incluindo unset) mantém o
// modo dry-run ativo. Isso evita que o worker comece a enviar pushes reais por acidente
// enquanto o pipeline legado (scheduled_notifications + pg_cron jobid 1/2) ainda está
// ativo e envia os MESMOS lembretes pelo mesmo canal — ligar as duas pipelines ao mesmo
// tempo duplicaria todo envio. Só desarme (definir "false" no ambiente do app) depois
// que o pipeline legado for desligado.
const DRY_RUN = process.env.NOTIFICATION_QUEUE_DRY_RUN !== "false";

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
      throw new Error(
        `Falha ao buscar consulta ${notification.referenceId}: ${appointmentError.message}`,
      );
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
      throw new Error(
        `Falha ao buscar gestante ${notification.referenceId}: ${patientError.message}`,
      );
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

    const daysUntilDpp = dayjs(pregnancy.due_date)
      .startOf("day")
      .diff(dayjs().startOf("day"), "day");

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

  if (notification.notificationType === "billing_reminder") {
    const { data: installment, error: installmentError } = await supabaseAdmin
      .from("installments")
      .select("amount, due_date, status, billing:billings!installments_billing_id_fkey(patient_id)")
      .eq("id", notification.referenceId)
      .maybeSingle();

    if (installmentError) {
      throw new Error(
        `Falha ao buscar parcela ${notification.referenceId}: ${installmentError.message}`,
      );
    }

    if (!installment || installment.status === "pago" || installment.status === "cancelado") {
      return null;
    }

    const billing = installment.billing as unknown as { patient_id: string } | null;
    if (!billing?.patient_id) return null;

    const template = getNotificationTemplate("billing_reminder", {
      amount: String(installment.amount),
      dueDate: dayjs(installment.due_date).format("DD/MM/YYYY"),
    });

    return {
      type: "billing_reminder",
      userId: notification.recipientId,
      title: template.title,
      body: template.body,
      url: `/patients/${billing.patient_id}/billing`,
    };
  }

  return null;
}

async function insertNotificationLog(
  supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
  notification: DequeuedNotification,
  status: "sent" | "failed",
  errorReason: string | null,
) {
  // Nota: para os tipos dpp_approaching/appointment_reminder, recipient_id aqui é sempre
  // patients.id (não patients.user_id) — o enqueue usa patients.id tanto como
  // reference_id quanto recipient_id; o destinatário real do push (patients.user_id) só
  // é resolvido depois, em resolvePushRecipientAndTemplate. Para billing_reminder (e
  // qualquer tipo futuro que use recipientType: "user"), recipient_id JÁ é o user_id real
  // (recipient_type = "user") — sem indireção via patients.id. Não leia
  // idx_notification_log_recipient como "quem recebeu o push de verdade" sem considerar o
  // recipient_type do tipo em questão.
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "push",
    notification_type: notification.notificationType,
    reference_type: notification.referenceType,
    reference_id: notification.referenceId,
    recipient_type: notification.recipientType,
    recipient_id: notification.recipientId,
    status,
    error_reason: errorReason,
  });

  if (error) {
    console.error("[process-notification-queues] failed to write notification_log row:", error);
  }
}

async function insertWhatsAppQueueLog(
  supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
  notification: DequeuedNotification,
  status: "sent" | "failed",
  errorReason: string | null,
  externalMessageId?: string,
) {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: notification.notificationType,
    reference_type: notification.referenceType,
    reference_id: notification.referenceId,
    recipient_type: notification.recipientType,
    recipient_id: notification.recipientId,
    status,
    error_reason: errorReason,
    external_message_id: externalMessageId ?? null,
  });

  if (error) {
    console.error("[process-notification-queues] failed to write whatsapp notification_log row:", error);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

      if (DRY_RUN) {
        // Modo shadow: valida o pipeline inteiro (dequeue, resolução de destinatário/
        // template, gravação em notification_log) sem disparar o envio real via Firebase
        // — evita duplicar envios enquanto o pipeline legado ainda está ativo (ver Fix 1).
        await insertNotificationLog(supabaseAdmin, notification, "sent", "dry_run (send skipped)");
        await ackNotification("push_notifications", notification.msgId);
        pushSent++;
        continue;
      }

      const sendResult = await sendNotificationToUser(resolved.userId, {
        type: resolved.type,
        title: resolved.title,
        body: resolved.body,
        data: { url: resolved.url },
      });

      if (sendResult.tokenCount === 0) {
        // Usuário não tem nenhum push_subscription ativo — não é um erro retentável, é
        // um estado legítimo (nada a reenviar). Loga distintamente de "sent" e apenas ack.
        await insertNotificationLog(supabaseAdmin, notification, "failed", "no active push tokens");
        await ackNotification("push_notifications", notification.msgId);
        pushSkipped++;
        continue;
      }

      if (sendResult.successCount === 0) {
        // Todos os tokens falharam — indistinguível de sucesso antes desta correção
        // (Fix 3). Lança para cair no mesmo caminho de classificação/retry/dead-letter
        // usado para qualquer outra falha de envio.
        throw new Error(
          `Push delivery failed for all ${sendResult.tokenCount} token(s) (user ${resolved.userId})`,
        );
      }

      await insertNotificationLog(supabaseAdmin, notification, "sent", null);
      await ackNotification("push_notifications", notification.msgId);
      pushSent++;
    } catch (err) {
      const classification = classifyPushError(err as { code?: string; message?: string });
      const reason = err instanceof Error ? err.message : "unknown error";

      try {
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
            reason,
          });
        } else {
          await requeueWithBackoff("push_notifications", notification.msgId, notification.readCt);
        }
      } catch (cleanupErr) {
        // deadLetterNotification/requeueWithBackoff são chamadas RPC e podem falhar por
        // conta própria (ex.: erro transiente de rede/DB) — uma falha aqui não deve
        // abortar o lote inteiro, só essa mensagem específica.
        console.error(
          `[process-notification-queues] failed to dead-letter/requeue msgId=${notification.msgId}:`,
          cleanupErr,
        );
      }
      pushFailed++;
    }
  }

  let whatsappSent = 0;
  let whatsappSkipped = 0;
  let whatsappFailed = 0;

  const whatsappMessages = await dequeueNotifications("whatsapp_notifications", 20, 60);

  for (const notification of whatsappMessages) {
    try {
      const handler =
        WHATSAPP_QUEUE_HANDLERS[notification.notificationType as WhatsAppNotificationType];

      if (!handler) {
        // Tipo desconhecido (ex.: mensagem de uma versão futura/antiga do worker) — descarta
        // sem tentar reenviar, não é um erro retentável.
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      const resolved = await handler(supabaseAdmin, notification);

      if (resolved.action === "skip") {
        await insertWhatsAppQueueLog(
          supabaseAdmin,
          notification,
          "failed",
          "skipped: condition no longer valid",
        );
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      if (DRY_RUN) {
        await insertWhatsAppQueueLog(supabaseAdmin, notification, "sent", "dry_run (send skipped)");
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSent++;
        continue;
      }

      const sendResult = await sendWhatsAppTemplateFromQueue(
        supabaseAdmin,
        resolved.recipient,
        notification.notificationType as WhatsAppNotificationType,
        resolved.templateParams,
      );

      if (sendResult.outcome === "skipped") {
        await insertWhatsAppQueueLog(supabaseAdmin, notification, "failed", sendResult.reason);
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      await insertWhatsAppQueueLog(
        supabaseAdmin,
        notification,
        "sent",
        null,
        sendResult.externalMessageId,
      );
      await ackNotification("whatsapp_notifications", notification.msgId);
      whatsappSent++;
    } catch (err) {
      const classification = classifyWhatsAppError(
        err instanceof WhatsAppApiError
          ? { code: err.code, message: err.message }
          : { message: err instanceof Error ? err.message : String(err) },
      );
      const reason = err instanceof Error ? err.message : "unknown error";

      try {
        if (classification === "permanent" || notification.readCt >= MAX_ATTEMPTS) {
          await deadLetterNotification({
            queueName: "whatsapp_notifications",
            msgId: notification.msgId,
            channel: "whatsapp",
            notificationType: notification.notificationType,
            referenceType: notification.referenceType,
            referenceId: notification.referenceId,
            recipientType: notification.recipientType,
            recipientId: notification.recipientId,
            reason,
          });
        } else {
          await requeueWithBackoff("whatsapp_notifications", notification.msgId, notification.readCt);
        }
      } catch (cleanupErr) {
        console.error(
          `[process-notification-queues] failed to dead-letter/requeue whatsapp msgId=${notification.msgId}:`,
          cleanupErr,
        );
      }
      whatsappFailed++;
    }
  }

  return NextResponse.json({
    push: { sent: pushSent, skipped: pushSkipped, failed: pushFailed },
    whatsapp: { sent: whatsappSent, skipped: whatsappSkipped, failed: whatsappFailed },
    dryRun: DRY_RUN,
  });
}
