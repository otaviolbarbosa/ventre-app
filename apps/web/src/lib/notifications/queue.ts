import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type QueueName = "push_notifications" | "whatsapp_notifications" | "email_notifications";

export type DequeuedNotification = {
  msgId: number;
  readCt: number;
  enqueuedAt: string;
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient" | "invite";
  recipientId: string;
};

export async function enqueueNotification(params: {
  queueName: QueueName;
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient" | "invite";
  recipientId: string;
  delaySeconds?: number;
  dedupKey?: string;
}): Promise<number> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("enqueue_notification", {
    p_queue_name: params.queueName,
    p_notification_type: params.notificationType,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_recipient_type: params.recipientType,
    p_recipient_id: params.recipientId,
    p_delay_seconds: params.delaySeconds ?? 0,
    p_dedup_key: params.dedupKey ?? "",
  });

  if (error) throw new Error(`enqueueNotification failed: ${error.message}`);
  return data as number;
}

export async function dequeueNotifications(
  queueName: QueueName,
  qty = 20,
  vt = 60,
): Promise<DequeuedNotification[]> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("dequeue_notifications", {
    p_queue_name: queueName,
    p_qty: qty,
    p_vt: vt,
  });

  if (error) throw new Error(`dequeueNotifications failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const message = row.message as {
      notification_type: string;
      reference_type: string;
      reference_id: string;
      recipient_type: "user" | "patient" | "invite";
      recipient_id: string;
    };
    return {
      msgId: row.msg_id,
      readCt: row.read_ct,
      enqueuedAt: row.enqueued_at,
      notificationType: message.notification_type,
      referenceType: message.reference_type,
      referenceId: message.reference_id,
      recipientType: message.recipient_type,
      recipientId: message.recipient_id,
    };
  });
}

export async function ackNotification(queueName: QueueName, msgId: number): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("ack_notification", {
    p_queue_name: queueName,
    p_msg_id: msgId,
  });

  if (error) throw new Error(`ackNotification failed: ${error.message}`);
}

export async function requeueWithBackoff(
  queueName: QueueName,
  msgId: number,
  readCt: number,
): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("requeue_with_backoff", {
    p_queue_name: queueName,
    p_msg_id: msgId,
    p_read_ct: readCt,
  });

  if (error) throw new Error(`requeueWithBackoff failed: ${error.message}`);
}

export async function getQueueLength(queueName: QueueName): Promise<number> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("notification_queue_length", {
    p_queue_name: queueName,
  });

  if (error) throw new Error(`getQueueLength failed: ${error.message}`);
  return data ?? 0;
}

export async function deadLetterNotification(params: {
  queueName: QueueName;
  msgId: number;
  channel: "push" | "whatsapp" | "email";
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient" | "invite";
  recipientId: string;
  reason: string;
}): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("dead_letter_notification", {
    p_queue_name: params.queueName,
    p_msg_id: params.msgId,
    p_channel: params.channel,
    p_notification_type: params.notificationType,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_recipient_type: params.recipientType,
    p_recipient_id: params.recipientId,
    p_reason: params.reason,
  });

  if (error) throw new Error(`deadLetterNotification failed: ${error.message}`);
}

export async function cancelNotificationsForReference(
  referenceType: string,
  referenceId: string,
): Promise<number> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("cancel_notifications_for_reference", {
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  });

  if (error) throw new Error(`cancelNotificationsForReference failed: ${error.message}`);
  return data as number;
}
