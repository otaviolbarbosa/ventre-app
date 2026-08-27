// apps/web/src/lib/notifications/notification-log.ts
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export type NotificationLogEntry = {
  id: string;
  notificationType: string;
  referenceType: string | null;
  referenceId: string | null;
};

// external_message_id não tem constraint de unicidade (ver migration da Task 1) — em teoria
// o mesmo wamid nunca se repete (é gerado pela Meta por envio), então pegar a linha mais
// recente é seguro e evita depender de uma constraint que não existe.
export async function findNotificationLogByExternalId(
  supabaseAdmin: SupabaseAdmin,
  externalMessageId: string,
): Promise<NotificationLogEntry | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .select("id, notification_type, reference_type, reference_id")
    .eq("external_message_id", externalMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar notification_log por external_message_id: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    notificationType: data.notification_type,
    referenceType: data.reference_type,
    referenceId: data.reference_id,
  };
}

// Ordem de progresso dos status de entrega. A Meta não garante ordem de entrega dos
// callbacks de status (um "delivered" pode chegar depois de um "read" já processado), e
// "failed" é terminal — nunca deve ser sobrescrito por um delivered/read atrasado.
const STATUS_RANK = { sent: 0, delivered: 1, read: 2, failed: 3 } as const;

// Best-effort: se o external_message_id não bate com nenhuma linha (log nunca gravado, ou já
// expirado/limpo), não lança — só não atualiza nada. O webhook precisa responder 200 de
// qualquer forma (ver rota, Task 5), então uma falha aqui nunca deve virar exceção não tratada.
//
// Só avança o status, nunca regride: lê o status atual antes de decidir se a atualização deve
// ser aplicada (rank da nova leitura >= rank atual, e o atual não pode já ser "failed" — esse é
// terminal). error_reason só é escrito quando o novo status é "failed"; para delivered/read a
// coluna nem entra no payload do update, preservando qualquer motivo de falha já registrado.
export async function updateNotificationLogStatusByExternalId(
  supabaseAdmin: SupabaseAdmin,
  externalMessageId: string,
  status: "delivered" | "read" | "failed",
  errorReason?: string | null,
): Promise<void> {
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("notification_log")
    .select("status")
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  if (fetchError) {
    console.error(
      "[notification-log] failed to read current status by external_message_id:",
      fetchError,
    );
    return;
  }
  if (!current) return;

  const currentStatus = current.status as keyof typeof STATUS_RANK;
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const newRank = STATUS_RANK[status];

  if (currentStatus === "failed" || newRank < currentRank) {
    return;
  }

  const updatePayload: { status: typeof status; error_reason?: string | null } = { status };
  if (status === "failed") {
    updatePayload.error_reason = errorReason ?? null;
  }

  const { error } = await supabaseAdmin
    .from("notification_log")
    .update(updatePayload)
    .eq("external_message_id", externalMessageId);

  if (error) {
    console.error("[notification-log] failed to update status by external_message_id:", error);
  }
}
