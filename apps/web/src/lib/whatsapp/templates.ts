export type WhatsAppNotificationType =
  // Fase 2 — action-triggered
  | "appointment_scheduled"
  | "appointment_updated"
  | "appointment_cancelled"
  | "patient_welcome"
  | "care_finished"
  | "installment_payment_link"
  | "contract_signed"
  | "contract_ready_for_signature"
  | "contract_change_requested"
  | "contract_fully_signed"
  | "billing_status_updated"
  | "vaccine_record_updated"
  // Fase 3 — trigger/cron-based (paciente)
  | "appointment_reminder"
  | "appointment_unconfirmed"
  | "installment_payment_reminder"
  | "installment_under_review_stalled"
  | "dpp_approaching"
  | "dpp_passed_no_birth_record"
  | "prenatal_followup_gap"
  | "contract_pending_signature"
  // Fase 3 — trigger/cron-based (profissional)
  | "daily_agenda_summary"
  | "payment_received"
  | "monthly_billing_report"
  | "installment_overdue_professional"
  | "appointment_last_minute_cancel"
  | "team_invite_pending"
  | "subscription_billing_issue"
  // Fase 3 — patient_invite_links (auto cadastro / vínculo de gestante existente)
  | "patient_self_registration_invite"
  | "patient_link_existing_invite";

type WhatsAppTemplateParams = {
  patientName?: string;
  professionalName?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentLink?: string;
  dueDate?: string;
  daysUntilDpp?: number;
  gapDays?: number;
  appointmentCount?: number;
  amount?: string;
  month?: string;
  inviteLink?: string;
};

type WhatsAppTemplate = {
  name: string;
  parameters: string[];
};

// Os nomes abaixo são placeholders de negócio — a submissão real dos templates no Meta
// Business Manager (Fase 0 da spec, processo externo) ainda não aconteceu. Quando os
// templates forem aprovados, troque só o valor de `name` de cada entrada pelo nome real
// aprovado; a ordem/quantidade de `parameters` já reflete os placeholders posicionais
// ({{1}}, {{2}}...) que cada corpo de mensagem vai usar.
export function getWhatsAppTemplate(
  type: WhatsAppNotificationType,
  params: WhatsAppTemplateParams,
): WhatsAppTemplate {
  const templates: Record<WhatsAppNotificationType, () => WhatsAppTemplate> = {
    appointment_scheduled: () => ({
      name: "appointment_scheduled",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_updated: () => ({
      name: "appointment_updated",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_cancelled: () => ({
      name: "appointment_cancelled",
      parameters: [params.patientName ?? "", params.date ?? ""],
    }),
    patient_welcome: () => ({
      name: "patient_welcome",
      parameters: [params.patientName ?? ""],
    }),
    care_finished: () => ({
      name: "care_finished",
      parameters: [params.patientName ?? ""],
    }),
    installment_payment_link: () => ({
      name: "installment_payment_link",
      parameters: [params.patientName ?? "", params.paymentLink ?? ""],
    }),
    contract_signed: () => ({
      name: "contract_signed",
      parameters: [params.patientName ?? ""],
    }),
    contract_ready_for_signature: () => ({
      name: "contract_ready_for_signature",
      parameters: [params.patientName ?? ""],
    }),
    contract_change_requested: () => ({
      name: "contract_change_requested",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    contract_fully_signed: () => ({
      name: "contract_fully_signed",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    billing_status_updated: () => ({
      name: "billing_status_updated",
      parameters: [params.patientName ?? "", params.status ?? ""],
    }),
    vaccine_record_updated: () => ({
      name: "vaccine_record_updated",
      parameters: [params.patientName ?? ""],
    }),
    appointment_reminder: () => ({
      name: "appointment_reminder",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_unconfirmed: () => ({
      name: "appointment_unconfirmed",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    installment_payment_reminder: () => ({
      name: "installment_payment_reminder",
      parameters: [params.patientName ?? "", params.dueDate ?? "", params.status ?? ""],
    }),
    installment_under_review_stalled: () => ({
      name: "installment_under_review_stalled",
      parameters: [params.patientName ?? ""],
    }),
    dpp_approaching: () => ({
      name: "dpp_approaching",
      parameters: [params.patientName ?? "", String(params.daysUntilDpp ?? "")],
    }),
    dpp_passed_no_birth_record: () => ({
      name: "dpp_passed_no_birth_record",
      parameters: [params.patientName ?? ""],
    }),
    prenatal_followup_gap: () => ({
      name: "prenatal_followup_gap",
      parameters: [params.patientName ?? "", String(params.gapDays ?? "")],
    }),
    contract_pending_signature: () => ({
      name: "contract_pending_signature",
      parameters: [params.patientName ?? ""],
    }),
    daily_agenda_summary: () => ({
      name: "daily_agenda_summary",
      parameters: [params.professionalName ?? "", String(params.appointmentCount ?? "")],
    }),
    payment_received: () => ({
      name: "payment_received",
      parameters: [params.professionalName ?? "", params.patientName ?? "", params.amount ?? ""],
    }),
    monthly_billing_report: () => ({
      name: "monthly_billing_report",
      parameters: [params.professionalName ?? "", params.month ?? "", params.amount ?? ""],
    }),
    installment_overdue_professional: () => ({
      name: "installment_overdue_professional",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    appointment_last_minute_cancel: () => ({
      name: "appointment_last_minute_cancel",
      parameters: [
        params.professionalName ?? "",
        params.patientName ?? "",
        params.date ?? "",
        params.time ?? "",
      ],
    }),
    team_invite_pending: () => ({
      name: "team_invite_pending",
      parameters: [params.professionalName ?? ""],
    }),
    subscription_billing_issue: () => ({
      name: "subscription_billing_issue",
      parameters: [params.professionalName ?? ""],
    }),
    patient_self_registration_invite: () => ({
      name: "patient_self_registration_invite",
      parameters: [params.patientName ?? "", params.inviteLink ?? ""],
    }),
    patient_link_existing_invite: () => ({
      name: "patient_link_existing_invite",
      parameters: [params.patientName ?? "", params.inviteLink ?? ""],
    }),
  };

  return templates[type]();
}
