import type { Database } from "@ventre/supabase/types";
import { z } from "zod";

type AppointmentType = Database["public"]["Enums"]["appointment_type"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

const appointmentTypes = ["consulta", "encontro"] as const satisfies readonly AppointmentType[];
const appointmentStatuses = [
  "agendada",
  "realizada",
  "cancelada",
] as const satisfies readonly AppointmentStatus[];

export const createAppointmentSchema = z
  .object({
    is_external: z.boolean().optional(),
    patient_id: z.string().optional(),
    professional_id: z.string().uuid().optional(),
    date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
      message: "Data inválida",
    }),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Horário inválido"),
    duration: z.number().min(15, "Duração mínima de 15 minutos").optional(),
    type: z.enum(appointmentTypes, {
      required_error: "Tipo de agendamento é obrigatório",
    }),
    location: z.string().optional(),
    notes: z.string().optional(),
    external_patient_name: z.string().optional(),
    external_patient_phone: z.string().optional(),
    external_patient_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.is_external) {
      if (!data.external_patient_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nome da paciente é obrigatório",
          path: ["external_patient_name"],
        });
      }
    } else {
      if (
        !data.patient_id ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.patient_id)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione uma paciente",
          path: ["patient_id"],
        });
      }
    }
  });

export const updateAppointmentSchema = z.object({
  date: z
    .string()
    .refine((date) => !Number.isNaN(Date.parse(date)), {
      message: "Data inválida",
    })
    .optional(),
  time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Horário inválido")
    .optional(),
  duration: z.number().min(15, "Duração mínima de 15 minutos").optional(),
  type: z.enum(appointmentTypes).optional(),
  status: z.enum(appointmentStatuses).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
