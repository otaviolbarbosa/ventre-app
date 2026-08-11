// apps/web/src/lib/notifications/whatsapp-inbound-handlers.ts
import type { NotificationLogEntry } from "@/lib/notifications/notification-log";
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export type WhatsAppInboundButtonHandler = (
  supabaseAdmin: SupabaseAdmin,
  logEntry: NotificationLogEntry,
) => Promise<{ handled: boolean; reason?: string }>;

// Único fluxo de quick-reply com contrato de dados definido na spec (Fluxo 4). O payload do
// botão ("confirm_appointment_presence") é um placeholder de negócio — troque pelo valor real
// quando o template com botão for aprovado no Meta Business Manager (Fase 0).
async function handleConfirmAppointmentPresence(
  supabaseAdmin: SupabaseAdmin,
  logEntry: NotificationLogEntry,
): Promise<{ handled: boolean; reason?: string }> {
  if (logEntry.referenceType !== "appointment" || !logEntry.referenceId) {
    return { handled: false, reason: `unexpected reference_type "${logEntry.referenceType}"` };
  }

  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("id", logEntry.referenceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Falha ao buscar consulta ${logEntry.referenceId}: ${error.message}`);
  }
  if (!appointment) {
    return { handled: false, reason: `appointment ${logEntry.referenceId} not found` };
  }

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({ confirmed_by_patient_at: new Date().toISOString() })
    .eq("id", logEntry.referenceId);
  if (updateError) {
    throw new Error(`Falha ao confirmar consulta ${logEntry.referenceId}: ${updateError.message}`);
  }

  return { handled: true };
}

export const WHATSAPP_INBOUND_BUTTON_HANDLERS: Record<string, WhatsAppInboundButtonHandler> = {
  confirm_appointment_presence: handleConfirmAppointmentPresence,
};
