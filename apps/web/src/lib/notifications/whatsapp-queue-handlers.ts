// apps/web/src/lib/notifications/whatsapp-queue-handlers.ts
import { dayjs } from "@/lib/dayjs";
import type { DequeuedNotification } from "@/lib/notifications/queue";
import type { WhatsAppQueueRecipient } from "@/lib/notifications/whatsapp-queue-send";
import type { getWhatsAppTemplate, WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;
type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];

export type WhatsAppQueueHandlerResult =
  | { action: "send"; recipient: WhatsAppQueueRecipient; templateParams: WhatsAppTemplateParams }
  | { action: "skip" };

export type WhatsAppQueueHandler = (
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
) => Promise<WhatsAppQueueHandlerResult>;

function recipientOf(notification: DequeuedNotification): WhatsAppQueueRecipient {
  return { recipientType: notification.recipientType, recipientId: notification.recipientId };
}

async function handleAppointmentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", date: appointment.date, time: appointment.time },
  };
}

async function handleAppointmentUnconfirmed(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, confirmed_by_patient_at, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada" || appointment.confirmed_by_patient_at) {
    return { action: "skip" };
  }

  const patient = appointment.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", date: appointment.date, time: appointment.time },
  };
}

async function handleInstallmentPaymentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("due_date, status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || (installment.status !== "pendente" && installment.status !== "atrasado")) {
    return { action: "skip" };
  }

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  const status = installment.status === "atrasado" ? "vencida" : "vencendo";
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", dueDate: installment.due_date, status },
  };
}

async function handleInstallmentUnderReviewStalled(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "em_analise") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "" },
  };
}

async function handleDppApproaching(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .select("due_date")
    .eq("patient_id", notification.referenceId)
    .eq("has_finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pregnancyError) {
    throw new Error(`Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`);
  }
  if (!pregnancy?.due_date) return { action: "skip" };

  const daysUntilDpp = dayjs(pregnancy.due_date).startOf("day").diff(dayjs().startOf("day"), "day");
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name, daysUntilDpp },
  };
}

async function handleDppPassedNoBirthRecord(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .select("due_date, has_finished, born_at")
    .eq("patient_id", notification.referenceId)
    .eq("has_finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pregnancyError) {
    throw new Error(`Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`);
  }
  if (!pregnancy?.due_date || pregnancy.born_at || !dayjs(pregnancy.due_date).isBefore(dayjs(), "day")) {
    return { action: "skip" };
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name },
  };
}

async function handlePrenatalFollowupGap(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: lastVisit } = await supabaseAdmin
    .from("appointments")
    .select("date")
    .eq("patient_id", notification.referenceId)
    .eq("status", "realizada")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastVisit) return { action: "skip" };

  const { count: upcomingCount } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", notification.referenceId)
    .eq("status", "agendada")
    .gte("date", dayjs().format("YYYY-MM-DD"));
  if ((upcomingCount ?? 0) > 0) return { action: "skip" };

  const gapDays = dayjs().startOf("day").diff(dayjs(lastVisit.date).startOf("day"), "day");
  if (gapDays < 45) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name, gapDays },
  };
}

async function handleContractPendingSignature(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("is_signed, is_active, patient:patients(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar contrato ${notification.referenceId}: ${error.message}`);
  if (!contract || contract.is_signed || !contract.is_active) return { action: "skip" };

  const patient = contract.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "" },
  };
}

async function handleDailyAgendaSummary(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: professional, error } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const { count } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", notification.referenceId)
    .eq("status", "agendada")
    .eq("date", dayjs().format("YYYY-MM-DD"));
  if (!count) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional.name, appointmentCount: count },
  };
}

async function handlePaymentReceived(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("paid_amount, installment:installments(billing:billings(patient:patients(name)))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar pagamento ${notification.referenceId}: ${error.message}`);
  if (!payment) return { action: "skip" };

  const patient = (
    payment.installment as unknown as {
      billing: { patient: { name: string } | null } | null;
    } | null
  )?.billing?.patient;
  if (!patient) return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient.name,
      amount: String(payment.paid_amount),
    },
  };
}

async function handleMonthlyBillingReport(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: professional, error } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const monthStart = dayjs().subtract(1, "month").startOf("month");
  const monthEnd = dayjs().subtract(1, "month").endOf("month");

  const { data: billings } = await supabaseAdmin
    .from("billings")
    .select("paid_amount, patient:patients!inner(created_by)")
    .eq("patient.created_by", notification.referenceId)
    .gte("created_at", monthStart.toISOString())
    .lte("created_at", monthEnd.toISOString());

  const total = (billings ?? []).reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  if (total === 0) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional.name,
      month: monthStart.format("MM/YYYY"),
      amount: String(total),
    },
  };
}

async function handleInstallmentOverdueProfessional(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "atrasado") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "", patientName: patient?.name ?? "" },
  };
}

async function handleAppointmentLastMinuteCancel(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "cancelada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient?.name ?? "",
      date: appointment.date,
      time: appointment.time,
    },
  };
}

async function handleTeamInvitePending(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select("status, invited_professional_id")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar convite ${notification.referenceId}: ${error.message}`);
  if (!invite || invite.status !== "pending" || !invite.invited_professional_id) return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", invite.invited_professional_id)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "" },
  };
}

async function handleSubscriptionBillingIssue(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, user_id")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar assinatura ${notification.referenceId}: ${error.message}`);
  if (!subscription || !subscription.user_id || subscription.status !== "failed") return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", subscription.user_id)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "" },
  };
}

export const WHATSAPP_QUEUE_HANDLERS: Partial<Record<WhatsAppNotificationType, WhatsAppQueueHandler>> = {
  appointment_reminder: handleAppointmentReminder,
  appointment_unconfirmed: handleAppointmentUnconfirmed,
  installment_payment_reminder: handleInstallmentPaymentReminder,
  installment_under_review_stalled: handleInstallmentUnderReviewStalled,
  dpp_approaching: handleDppApproaching,
  dpp_passed_no_birth_record: handleDppPassedNoBirthRecord,
  prenatal_followup_gap: handlePrenatalFollowupGap,
  contract_pending_signature: handleContractPendingSignature,
  daily_agenda_summary: handleDailyAgendaSummary,
  payment_received: handlePaymentReceived,
  monthly_billing_report: handleMonthlyBillingReport,
  installment_overdue_professional: handleInstallmentOverdueProfessional,
  appointment_last_minute_cancel: handleAppointmentLastMinuteCancel,
  team_invite_pending: handleTeamInvitePending,
  subscription_billing_issue: handleSubscriptionBillingIssue,
};
