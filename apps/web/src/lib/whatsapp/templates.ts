export type WhatsAppNotificationType =
  | "appointment_scheduled"
  | "appointment_updated"
  | "appointment_cancelled"
  | "patient_welcome"
  | "care_finished"
  | "installment_payment_link"
  | "contract_signed"
  | "billing_status_updated"
  | "vaccine_record_updated";

type WhatsAppTemplateParams = {
  patientName?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentLink?: string;
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
    billing_status_updated: () => ({
      name: "billing_status_updated",
      parameters: [params.patientName ?? "", params.status ?? ""],
    }),
    vaccine_record_updated: () => ({
      name: "vaccine_record_updated",
      parameters: [params.patientName ?? ""],
    }),
  };

  return templates[type]();
}
