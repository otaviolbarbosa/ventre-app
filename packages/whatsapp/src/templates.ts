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
  | "birth_mode_activated"
  // Fase 3 — trigger/cron-based (paciente)
  | "appointment_reminder"
  | "appointment_unconfirmed"
  | "cancel_appointment_patient"
  | "installment_payment_reminder"
  | "installment_overdue_reminder"
  | "installment_under_review_stalled"
  | "dpp_approaching"
  | "dpp_passed_no_birth_record"
  | "prenatal_followup_gap"
  | "contract_pending_signature"
  | "contract_created"
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
  inviterName?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentLink?: string;
  dueDate?: string;
  daysUntilDpp?: number;
  dppDate?: string;
  gapDays?: number;
  appointmentCount?: number;
  appointmentType?: string;
  location?: string;
  amount?: string;
  billingName?: string;
  overdueInfo?: string;
  overdueDays?: number;
  paymentMethod?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  paymentDate?: string;
  paymentCount?: number;
  comparison?: string;
  month?: string;
  firstAppointmentTime?: string;
  lastAppointmentTime?: string;
  daysRemaining?: number;
  planName?: string;
  patientInviteId?: string;
  contractId?: string;
  appointmentId?: string;
};

type WhatsAppTemplate = {
  name: string;
  parameters: string[];
  buttonParameters?: string[];
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
    // name real aprovado no Business Manager já veio como "new_appointment" — chave interna
    // fica appointment_scheduled por consistência com o resto do arquivo. Botões (0 = confirmar,
    // 1 = cancelar) levam o mesmo appointmentId; a URL de cada botão (com ?aid=) é configurada
    // no próprio template aprovado na Meta, não aqui.
    appointment_scheduled: () => ({
      name: "new_appointment",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
      buttonParameters: [params.appointmentId ?? "", params.appointmentId ?? ""],
    }),
    // name real aprovado: "appointment_rescheduling". Mesmo esquema de botões do item acima.
    appointment_updated: () => ({
      name: "appointment_rescheduling",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
      buttonParameters: [params.appointmentId ?? "", params.appointmentId ?? ""],
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
    // Corpo do template deve ficar genérico/operacional (ex.: "Modo Parto ativado para
    // {{2}}. Abra o app para acompanhar.") — política do WhatsApp Business restringe
    // conteúdo relacionado a saúde em templates, então nada de termos clínicos aqui.
    birth_mode_activated: () => ({
      name: "birth_mode_activated",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    appointment_reminder: () => ({
      name: "appointment_reminder",
      parameters: [
        params.patientName ?? "",
        params.appointmentType ?? "",
        params.date ?? "",
        params.time ?? "",
        params.professionalName ?? "",
        params.location ?? "Não informado",
      ],
    }),
    appointment_unconfirmed: () => ({
      name: "appointment_unconfirmed",
      parameters: [
        params.patientName ?? "",
        params.date ?? "",
        params.time ?? "",
        params.professionalName ?? "",
      ],
    }),
    cancel_appointment_patient: () => ({
      name: "cancel_appointment_patient",
      parameters: [
        params.patientName ?? "",
        params.date ?? "",
        params.time ?? "",
        params.professionalName ?? "",
      ],
    }),
    installment_payment_reminder: () => ({
      name: "installment_payment_reminder",
      parameters: [
        params.patientName ?? "",
        String(params.installmentNumber ?? ""),
        params.billingName ?? "",
        params.amount ?? "",
        params.dueDate ?? "",
        params.professionalName ?? "",
      ],
    }),
    installment_overdue_reminder: () => ({
      name: "installment_overdue_reminder",
      parameters: [params.patientName ?? "", params.amount ?? "", params.overdueInfo ?? ""],
    }),
    installment_under_review_stalled: () => ({
      name: "installment_under_review_stalled",
      parameters: [params.patientName ?? "", params.professionalName ?? "", params.amount ?? ""],
    }),
    dpp_approaching: () => ({
      name: "dpp_approaching",
      parameters: [
        params.patientName ?? "",
        String(params.daysUntilDpp ?? ""),
        params.dppDate ?? "",
        params.professionalName ?? "",
      ],
    }),
    dpp_passed_no_birth_record: () => ({
      name: "dpp_passed_no_birth_record",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    prenatal_followup_gap: () => ({
      name: "prenatal_followup_gap",
      parameters: [
        params.patientName ?? "",
        String(params.gapDays ?? ""),
        params.professionalName ?? "",
      ],
    }),
    contract_pending_signature: () => ({
      name: "contract_pending_signature",
      parameters: [params.patientName ?? "", params.professionalName ?? ""],
      buttonParameters: [params.contractId ?? ""],
    }),
    contract_created: () => ({
      name: "contract_created",
      parameters: [params.patientName ?? "", params.professionalName ?? ""],
      buttonParameters: [params.contractId ?? ""],
    }),
    daily_agenda_summary: () => ({
      name: "daily_agenda_summary",
      parameters: [
        params.professionalName ?? "",
        String(params.appointmentCount ?? ""),
        params.firstAppointmentTime ?? "",
        params.lastAppointmentTime ?? "",
      ],
    }),
    payment_received: () => ({
      name: "payment_received",
      parameters: [
        params.professionalName ?? "",
        params.amount ?? "",
        params.patientName ?? "",
        params.paymentMethod ?? "",
        String(params.installmentNumber ?? ""),
        String(params.totalInstallments ?? ""),
        params.paymentDate ?? "",
      ],
    }),
    monthly_billing_report: () => ({
      name: "monthly_billing_report",
      parameters: [
        params.professionalName ?? "",
        params.month ?? "",
        params.amount ?? "",
        String(params.paymentCount ?? ""),
        params.comparison ?? "",
      ],
    }),
    installment_overdue_professional: () => ({
      name: "installment_overdue_professional",
      parameters: [
        params.professionalName ?? "",
        params.patientName ?? "",
        params.amount ?? "",
        String(params.overdueDays ?? ""),
        params.dueDate ?? "",
      ],
    }),
    appointment_last_minute_cancel: () => ({
      name: "appointment_last_minute_cancel",
      parameters: [params.professionalName ?? "", params.patientName ?? "", params.time ?? ""],
    }),
    team_invite_pending: () => ({
      name: "team_invite_pending",
      parameters: [
        params.professionalName ?? "",
        params.inviterName ?? "",
        params.patientName ?? "",
        String(params.daysRemaining ?? ""),
      ],
    }),
    subscription_billing_issue: () => ({
      name: "subscription_billing_issue",
      parameters: [params.professionalName ?? "", params.planName ?? ""],
    }),
    patient_self_registration_invite: () => ({
      name: "patient_self_registration_invite",
      parameters: [params.patientName ?? ""],
      buttonParameters: [params.patientInviteId ?? ""],
    }),
    patient_link_existing_invite: () => ({
      name: "patient_link_existing_invite",
      parameters: [params.patientName ?? ""],
      buttonParameters: [params.patientInviteId ?? ""],
    }),
  };

  return templates[type]();
}
