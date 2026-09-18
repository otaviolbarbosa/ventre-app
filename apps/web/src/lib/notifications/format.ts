import { dayjs } from "@/lib/dayjs";

// "hoje"/"amanhã" para os dois dias mais relevantes, DD/MM para o resto — usado em todo
// template de WhatsApp que mostra uma data absoluta (não confundir com o texto relativo
// "em N dias" de installment_payment_reminder, que tem sua própria lógica).
export function formatFriendlyDate(date: string): string {
  const target = dayjs(date).startOf("day");
  const diffDays = target.diff(dayjs().startOf("day"), "day");

  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "amanhã";
  return target.format("DD/MM");
}

// Normaliza "HH:MM:SS" (formato `time` do Postgres) para "HH:MM" — um slice simples evita
// depender do dayjs para parsear um horário sem data associada.
export function formatFriendlyTime(time: string): string {
  return time.slice(0, 5);
}
