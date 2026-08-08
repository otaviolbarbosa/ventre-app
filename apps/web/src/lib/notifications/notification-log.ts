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

// Best-effort: se o external_message_id não bate com nenhuma linha (log nunca gravado, ou já
// expirado/limpo), não lança — só não atualiza nada. O webhook precisa responder 200 de
// qualquer forma (ver rota, Task 5), então uma falha aqui nunca deve virar exceção não tratada.
export async function updateNotificationLogStatusByExternalId(
  supabaseAdmin: SupabaseAdmin,
  externalMessageId: string,
  status: "delivered" | "read" | "failed",
  errorReason?: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notification_log")
    .update({ status, error_reason: errorReason ?? null })
    .eq("external_message_id", externalMessageId);

  if (error) {
    console.error("[notification-log] failed to update status by external_message_id:", error);
  }
}
