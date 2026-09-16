"use server";

import { adminActionClient } from "@/lib/safe-action";
import { getWhatsAppTemplate, normalizePhoneToE164, sendWhatsAppTemplateMessage } from "@ventre/whatsapp";
import { z } from "zod";

const phoneSchema = z.string().min(10, "Informe um telefone válido (DDD + número)");

const testWhatsAppTemplateSchema = z.discriminatedUnion("templateType", [
  z.object({
    templateType: z.literal("appointment_reminder"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    appointmentType: z.string().min(1, "Obrigatório"),
    date: z.string().min(1, "Obrigatório"),
    time: z.string().min(1, "Obrigatório"),
    professionalName: z.string().min(1, "Obrigatório"),
    location: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("subscription_billing_issue"),
    phone: phoneSchema,
    professionalName: z.string().min(1, "Obrigatório"),
    planName: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("patient_self_registration_invite"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    patientInviteId: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("patient_link_existing_invite"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    patientInviteId: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("birth_mode_activated"),
    phone: phoneSchema,
    professionalName: z.string().min(1, "Obrigatório"),
    patientName: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("installment_payment_reminder"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    installmentNumber: z.coerce.number().int().min(1, "Obrigatório"),
    billingName: z.string().min(1, "Obrigatório"),
    amount: z.string().min(1, "Obrigatório"),
    dueDate: z.string().min(1, "Obrigatório"),
    professionalName: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("contract_pending_signature"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    professionalName: z.string().min(1, "Obrigatório"),
    contractId: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("contract_created"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    professionalName: z.string().min(1, "Obrigatório"),
    contractId: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("daily_agenda_summary"),
    phone: phoneSchema,
    professionalName: z.string().min(1, "Obrigatório"),
    appointmentCount: z.coerce.number().int().min(1, "Obrigatório"),
    firstAppointmentTime: z.string().min(1, "Obrigatório"),
    lastAppointmentTime: z.string().min(1, "Obrigatório"),
  }),
  z.object({
    templateType: z.literal("cancel_appointment_patient"),
    phone: phoneSchema,
    patientName: z.string().min(1, "Obrigatório"),
    date: z.string().min(1, "Obrigatório"),
    time: z.string().min(1, "Obrigatório"),
    professionalName: z.string().min(1, "Obrigatório"),
  }),
]);

export const testWhatsAppTemplateAction = adminActionClient
  .schema(testWhatsAppTemplateSchema)
  .action(async ({ parsedInput }) => {
    const { templateType, phone, ...params } = parsedInput;

    const to = normalizePhoneToE164(phone);
    if (!to) throw new Error("Telefone inválido — use DDD + número (ex: 11987654321)");

    const template = getWhatsAppTemplate(templateType, params);

    const { externalMessageId } = await sendWhatsAppTemplateMessage({
      to,
      templateName: template.name,
      parameters: template.parameters,
      buttonParameter: template.buttonParameter,
    });

    return { externalMessageId, templateName: template.name };
  });
