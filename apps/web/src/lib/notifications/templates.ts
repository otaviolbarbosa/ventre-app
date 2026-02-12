import type { NotificationType } from "./send";

type NotificationTemplate = {
  title: string;
  body: string;
};

type TemplateParams = {
  patientName?: string;
  professionalName?: string;
  date?: string;
  time?: string;
  documentName?: string;
  daysUntilDpp?: number;
  amount?: string;
  dueDate?: string;
  description?: string;
  installmentNumber?: number;
};

export function getNotificationTemplate(
  type: NotificationType,
  params: TemplateParams,
): NotificationTemplate {
  const templates: Record<NotificationType, () => NotificationTemplate> = {
    appointment_created: () => ({
      title: "Nova consulta agendada",
      body: `Consulta com ${params.patientName} em ${params.date} às ${params.time}.`,
    }),
    appointment_updated: () => ({
      title: "Consulta atualizada",
      body: `A consulta com ${params.patientName} foi alterada para ${params.date} às ${params.time}.`,
    }),
    appointment_cancelled: () => ({
      title: "Consulta cancelada",
      body: `A consulta com ${params.patientName} em ${params.date} foi cancelada.`,
    }),
    appointment_reminder: () => ({
      title: "Lembrete de consulta",
      body: `Você tem uma consulta com ${params.patientName} em ${params.date} às ${params.time}.`,
    }),
    team_invite_received: () => ({
      title: "Novo convite de equipe",
      body: `${params.professionalName} convidou você para a equipe de ${params.patientName}.`,
    }),
    team_invite_accepted: () => ({
      title: "Convite aceito",
      body: `${params.professionalName} aceitou o convite para a equipe de ${params.patientName}.`,
    }),
    document_uploaded: () => ({
      title: "Novo documento",
      body: `${params.professionalName} enviou "${params.documentName}" para ${params.patientName}.`,
    }),
    evolution_added: () => ({
      title: "Nova evolução registrada",
      body: `${params.professionalName} adicionou uma evolução para ${params.patientName}.`,
    }),
    dpp_approaching: () => ({
      title: "DPP se aproximando",
      body: `A data provável de parto de ${params.patientName} é em ${params.daysUntilDpp} dias.`,
    }),
    billing_created: () => ({
      title: "Nova cobrança criada",
      body: `${params.description} - ${params.amount}`,
    }),
    billing_payment_received: () => ({
      title: "Pagamento registrado",
      body: `Parcela ${params.installmentNumber} de ${params.description} - ${params.amount}`,
    }),
    billing_reminder: () => ({
      title: "Vencimento próximo",
      body: `Parcela de ${params.amount} vence em ${params.dueDate}`,
    }),
  };

  return templates[type]();
}
