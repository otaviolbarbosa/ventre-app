// apps/web/src/lib/notifications/whatsapp-queue-handlers.ts
import { dayjs } from "@/lib/dayjs";
import type { DequeuedNotification } from "@/lib/notifications/queue";
import type { WhatsAppQueueRecipient } from "@/lib/notifications/whatsapp-queue-send";
import type { getWhatsAppTemplate, WhatsAppNotificationType } from "@ventre/whatsapp";
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

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consulta: "Consulta",
  exame: "Exame",
  encontro: "Encontro",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  pix: "Pix",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

function recipientOf(notification: DequeuedNotification): WhatsAppQueueRecipient {
  return { recipientType: notification.recipientType, recipientId: notification.recipientId };
}

async function handleAppointmentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "date, time, status, type, location, patient:patients!appointments_patient_id_fkey(name), professional:users(name)",
    )
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  const professional = appointment.professional as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient?.name ?? "",
      appointmentType: APPOINTMENT_TYPE_LABELS[appointment.type] ?? appointment.type,
      date: appointment.date,
      time: appointment.time,
      professionalName: professional?.name ?? "",
      location: appointment.location ?? "Não informado",
    },
  };
}

async function handleAppointmentUnconfirmed(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "date, time, status, confirmed_by_patient_at, patient:patients!appointments_patient_id_fkey(name), professional:users(name)",
    )
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada" || appointment.confirmed_by_patient_at) {
    return { action: "skip" };
  }

  const patient = appointment.patient as unknown as { name: string } | null;
  const professional = appointment.professional as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient?.name ?? "",
      date: appointment.date,
      time: appointment.time,
      professionalName: professional?.name ?? "",
    },
  };
}

async function handleInstallmentPaymentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select(
      "due_date, amount, status, billing:billings(description, patient:patients(name, created_by))",
    )
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "pendente") return { action: "skip" };

  const billing = installment.billing as unknown as {
    description: string;
    patient: { name: string; created_by: string } | null;
  } | null;
  const patient = billing?.patient;
  if (!patient) return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", patient.created_by)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${patient.created_by}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient.name,
      amount: String(installment.amount),
      billingName: billing?.description ?? "",
      dueDate: installment.due_date,
      professionalName: professional?.name ?? "",
    },
  };
}

async function handleInstallmentOverdueReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("due_date, amount, status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "atrasado") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)
    ?.patient;
  if (!patient) return { action: "skip" };

  const overdueDays = dayjs()
    .startOf("day")
    .diff(dayjs(installment.due_date).startOf("day"), "day");
  const overdueInfo =
    overdueDays <= 0 ? "vence hoje" : `venceu há ${overdueDays} dia${overdueDays > 1 ? "s" : ""}`;

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient.name,
      amount: String(installment.amount),
      overdueInfo,
    },
  };
}

async function handleInstallmentUnderReviewStalled(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, amount, updated_at, billing:billings(patient:patients(name, created_by))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (
    !installment ||
    installment.status !== "em_analise" ||
    dayjs().diff(dayjs(installment.updated_at), "day") < 3
  ) {
    return { action: "skip" };
  }

  const patient = (
    installment.billing as unknown as {
      patient: { name: string; created_by: string } | null;
    } | null
  )?.patient;
  if (!patient) return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", patient.created_by)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${patient.created_by}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient.name,
      professionalName: professional?.name ?? "",
      amount: String(installment.amount),
    },
  };
}

async function handleDppApproaching(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name, created_by")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
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
    throw new Error(
      `Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`,
    );
  }
  if (!pregnancy?.due_date) return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", patient.created_by)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${patient.created_by}: ${professionalError.message}`,
    );
  }

  const daysUntilDpp = dayjs(pregnancy.due_date).startOf("day").diff(dayjs().startOf("day"), "day");
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient.name,
      daysUntilDpp,
      dppDate: pregnancy.due_date,
      professionalName: professional?.name ?? "",
    },
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
  if (error)
    throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
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
    throw new Error(
      `Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`,
    );
  }
  if (
    !pregnancy?.due_date ||
    pregnancy.born_at ||
    !dayjs(pregnancy.due_date).isBefore(dayjs(), "day")
  ) {
    return { action: "skip" };
  }

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${notification.recipientId}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "", patientName: patient.name },
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
  if (error)
    throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: lastVisit, error: lastVisitError } = await supabaseAdmin
    .from("appointments")
    .select("date, professional:users(name)")
    .eq("patient_id", notification.referenceId)
    .eq("status", "realizada")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastVisitError) {
    throw new Error(
      `Falha ao buscar última consulta de ${notification.referenceId}: ${lastVisitError.message}`,
    );
  }
  if (!lastVisit) return { action: "skip" };

  const { count: upcomingCount, error: upcomingCountError } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", notification.referenceId)
    .eq("status", "agendada")
    .gte("date", dayjs().format("YYYY-MM-DD"));
  if (upcomingCountError) {
    throw new Error(
      `Falha ao buscar consultas futuras de ${notification.referenceId}: ${upcomingCountError.message}`,
    );
  }
  if ((upcomingCount ?? 0) > 0) return { action: "skip" };

  const gapDays = dayjs().startOf("day").diff(dayjs(lastVisit.date).startOf("day"), "day");
  if (gapDays < 45) return { action: "skip" };

  const professional = lastVisit.professional as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      patientName: patient.name,
      gapDays,
      professionalName: professional?.name ?? "",
    },
  };
}

async function handleContractPendingSignature(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("is_signed, is_active, created_at, patient:patients(name, created_by)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar contrato ${notification.referenceId}: ${error.message}`);
  if (
    !contract ||
    contract.is_signed ||
    !contract.is_active ||
    dayjs().diff(dayjs(contract.created_at), "day") < 3
  ) {
    return { action: "skip" };
  }

  const patient = contract.patient as unknown as { name: string; created_by: string } | null;
  if (!patient) return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", patient.created_by)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${patient.created_by}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name, professionalName: professional?.name ?? "" },
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
  if (error)
    throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const { data: todaysAppointments, error: appointmentsError } = await supabaseAdmin
    .from("appointments")
    .select("time")
    .eq("professional_id", notification.referenceId)
    .eq("status", "agendada")
    .eq("date", dayjs().format("YYYY-MM-DD"))
    .order("time", { ascending: true });
  if (appointmentsError) {
    throw new Error(
      `Falha ao buscar agenda do profissional ${notification.referenceId}: ${appointmentsError.message}`,
    );
  }
  if (!todaysAppointments?.length) return { action: "skip" };

  const [firstAppointment] = todaysAppointments;
  const lastAppointment = todaysAppointments[todaysAppointments.length - 1];

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional.name,
      appointmentCount: todaysAppointments.length,
      firstAppointmentTime: firstAppointment?.time ?? "",
      lastAppointmentTime: lastAppointment?.time ?? "",
    },
  };
}

async function handlePaymentReceived(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select(
      "paid_amount, paid_at, payment_method, installment:installments(installment_number, billing:billings(installment_count, patient:patients(name)))",
    )
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar pagamento ${notification.referenceId}: ${error.message}`);
  if (!payment) return { action: "skip" };

  const installment = payment.installment as unknown as {
    installment_number: number;
    billing: { installment_count: number; patient: { name: string } | null } | null;
  } | null;
  const patient = installment?.billing?.patient;
  if (!patient) return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${notification.recipientId}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient.name,
      amount: String(payment.paid_amount),
      paymentMethod: PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method,
      installmentNumber: installment?.installment_number,
      totalInstallments: installment?.billing?.installment_count,
      paymentDate: payment.paid_at,
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
  if (error)
    throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const monthStart = dayjs().subtract(1, "month").startOf("month");
  const monthEnd = dayjs().subtract(1, "month").endOf("month");
  const previousMonthStart = dayjs().subtract(2, "month").startOf("month");
  const previousMonthEnd = dayjs().subtract(2, "month").endOf("month");

  const { data: billings, error: billingsError } = await supabaseAdmin
    .from("billings")
    .select("paid_amount, patient:patients!inner(created_by)")
    .eq("patient.created_by", notification.referenceId)
    .gte("created_at", monthStart.toISOString())
    .lte("created_at", monthEnd.toISOString());
  if (billingsError) {
    throw new Error(
      `Falha ao buscar faturamento do profissional ${notification.referenceId}: ${billingsError.message}`,
    );
  }

  const total = (billings ?? []).reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  if (total === 0) return { action: "skip" };

  const { data: previousBillings, error: previousBillingsError } = await supabaseAdmin
    .from("billings")
    .select("paid_amount, patient:patients!inner(created_by)")
    .eq("patient.created_by", notification.referenceId)
    .gte("created_at", previousMonthStart.toISOString())
    .lte("created_at", previousMonthEnd.toISOString());
  if (previousBillingsError) {
    throw new Error(
      `Falha ao buscar faturamento anterior do profissional ${notification.referenceId}: ${previousBillingsError.message}`,
    );
  }

  const previousTotal = (previousBillings ?? []).reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  const comparison =
    previousTotal === 0
      ? "sem registros anteriores"
      : (() => {
          const diffPct = Math.round(((total - previousTotal) / previousTotal) * 100);
          const label = previousMonthStart.format("MMMM");
          return diffPct >= 0
            ? `${diffPct}% a mais que em ${label}`
            : `${Math.abs(diffPct)}% a menos que em ${label}`;
        })();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional.name,
      month: monthStart.format("MM/YYYY"),
      amount: String(total),
      // aproximação: conta faturas pagas no mês, não linhas de `payments` — mesma fonte de
      // dado já usada para somar `total` acima, mantém consistência entre os dois números
      paymentCount: billings?.length ?? 0,
      comparison,
    },
  };
}

async function handleInstallmentOverdueProfessional(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, amount, due_date, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "atrasado") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)
    ?.patient;
  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${notification.recipientId}: ${professionalError.message}`,
    );
  }

  const overdueDays = dayjs()
    .startOf("day")
    .diff(dayjs(installment.due_date).startOf("day"), "day");

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient?.name ?? "",
      amount: String(installment.amount),
      overdueDays,
      dueDate: installment.due_date,
    },
  };
}

async function handleAppointmentLastMinuteCancel(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("time, status, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "cancelada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${notification.recipientId}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient?.name ?? "",
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
    .select("status, invited_professional_id, invited_by, expires_at, patient:patients(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar convite ${notification.referenceId}: ${error.message}`);
  // Valor do enum é "pendente" (pt-BR), não "pending" — o check antigo nunca batia e o
  // handler nunca enviava nenhuma mensagem para este tipo de notificação.
  if (!invite || invite.status !== "pendente" || !invite.invited_professional_id) {
    return { action: "skip" };
  }

  const patient = invite.patient as unknown as { name: string } | null;

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", invite.invited_professional_id)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${invite.invited_professional_id}: ${professionalError.message}`,
    );
  }

  const { data: inviter, error: inviterError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", invite.invited_by)
    .maybeSingle();
  if (inviterError) {
    throw new Error(`Falha ao buscar profissional ${invite.invited_by}: ${inviterError.message}`);
  }

  const daysRemaining = dayjs(invite.expires_at).startOf("day").diff(dayjs().startOf("day"), "day");

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      inviterName: inviter?.name ?? "",
      patientName: patient?.name ?? "",
      daysRemaining,
    },
  };
}

async function handleSubscriptionBillingIssue(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, user_id, plan:plans(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar assinatura ${notification.referenceId}: ${error.message}`);
  if (!subscription || !subscription.user_id || subscription.status !== "failed")
    return { action: "skip" };

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", subscription.user_id)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${subscription.user_id}: ${professionalError.message}`,
    );
  }

  const plan = subscription.plan as unknown as { name: string } | null;

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "", planName: plan?.name ?? "" },
  };
}

async function handlePatientInviteLink(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: invite, error } = await supabaseAdmin
    .from("patient_invite_links")
    .select("id, name, phone, used_at, expires_at")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Falha ao buscar convite ${notification.referenceId}: ${error.message}`);
  }
  if (
    !invite ||
    !invite.phone ||
    invite.used_at ||
    (invite.expires_at && dayjs(invite.expires_at).isBefore(dayjs()))
  ) {
    return { action: "skip" };
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: invite.name ?? "Gestante", patientInviteId: invite.id },
  };
}

async function handleBirthModeActivated(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: pregnancy, error } = await supabaseAdmin
    .from("pregnancies")
    .select("birth_mode_active, patient:patients!pregnancies_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar gestação ${notification.referenceId}: ${error.message}`);
  if (!pregnancy || !pregnancy.birth_mode_active) return { action: "skip" };

  const patient = pregnancy.patient as unknown as { name: string } | null;

  const { data: professional, error: professionalError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();
  if (professionalError) {
    throw new Error(
      `Falha ao buscar profissional ${notification.recipientId}: ${professionalError.message}`,
    );
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient?.name ?? "",
    },
  };
}

export const WHATSAPP_QUEUE_HANDLERS: Partial<
  Record<WhatsAppNotificationType, WhatsAppQueueHandler>
> = {
  appointment_reminder: handleAppointmentReminder,
  appointment_unconfirmed: handleAppointmentUnconfirmed,
  installment_payment_reminder: handleInstallmentPaymentReminder,
  installment_overdue_reminder: handleInstallmentOverdueReminder,
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
  patient_self_registration_invite: handlePatientInviteLink,
  patient_link_existing_invite: handlePatientInviteLink,
  birth_mode_activated: handleBirthModeActivated,
};
