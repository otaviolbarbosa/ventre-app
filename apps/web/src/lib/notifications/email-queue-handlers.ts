// apps/web/src/lib/notifications/email-queue-handlers.ts
import { dayjs } from "@/lib/dayjs";
import type { DequeuedNotification } from "@/lib/notifications/queue";
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export type EmailNotificationType =
  | "patient_self_registration_invite"
  | "patient_link_existing_invite";

export type EmailQueueHandlerResult =
  | {
      action: "send";
      to: string;
      params: { name: string; enterpriseName?: string | null; inviteLink: string };
    }
  | { action: "skip" };

export type EmailQueueHandler = (
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
) => Promise<EmailQueueHandlerResult>;

async function handlePatientInviteEmail(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<EmailQueueHandlerResult> {
  const { data: invite, error } = await supabaseAdmin
    .from("patient_invite_links")
    .select("id, name, email, used_at, expires_at, enterprises(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Falha ao buscar convite ${notification.referenceId}: ${error.message}`);
  }
  if (
    !invite ||
    !invite.email ||
    invite.used_at ||
    (invite.expires_at && dayjs(invite.expires_at).isBefore(dayjs()))
  ) {
    return { action: "skip" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    action: "send",
    to: invite.email,
    params: {
      name: invite.name ?? "Gestante",
      enterpriseName: invite.enterprises?.name,
      inviteLink: `${appUrl}/patient-registration?piid=${invite.id}`,
    },
  };
}

export const EMAIL_QUEUE_HANDLERS: Partial<Record<EmailNotificationType, EmailQueueHandler>> = {
  patient_self_registration_invite: handlePatientInviteEmail,
  patient_link_existing_invite: handlePatientInviteEmail,
};
