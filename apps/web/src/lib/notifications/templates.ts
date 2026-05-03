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
  vaccineName?: string;
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
    patient_added: () => ({
      title: "Nova gestante cadastrada",
      body: `${params.patientName} foi adicionada à sua lista de gestantes.`,
    }),
    team_member_added: () => ({
      title: "Nova profissional na equipe",
      body: `${params.professionalName} foi adicionada à equipe de ${params.patientName}.`,
    }),
    obstetric_history_updated: () => ({
      title: "Histórico obstétrico atualizado",
      body: `O histórico obstétrico de ${params.patientName} foi atualizado.`,
    }),
    risk_factors_updated: () => ({
      title: "Fatores de risco atualizados",
      body: `Os fatores de risco de ${params.patientName} foram atualizados.`,
    }),
    pregnancy_evolution_added: () => ({
      title: "Nova evolução gestacional",
      body: `Evolução gestacional registrada para ${params.patientName}.`,
    }),
    lab_exam_added: () => ({
      title: "Novo exame laboratorial",
      body: `Exame laboratorial registrado para ${params.patientName}.`,
    }),
    other_exam_added: () => ({
      title: "Novo exame registrado",
      body: `Exame registrado para ${params.patientName}.`,
    }),
    ultrasound_added: () => ({
      title: "Novo ultrassom registrado",
      body: `Ultrassom registrado para ${params.patientName}.`,
    }),
    vaccine_updated: () => ({
      title: "Vacina atualizada",
      body: `Vacina de ${params.patientName} atualizada.`,
    }),
  };

  return templates[type]();
}
