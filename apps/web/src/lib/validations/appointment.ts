import { z } from "zod";
import type { Database } from "@nascere/supabase/types";

type AppointmentType = Database["public"]["Enums"]["appointment_type"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

const appointmentTypes = ["consulta", "encontro"] as const satisfies readonly AppointmentType[];
const appointmentStatuses = [
  "agendada",
  "realizada",
  "cancelada",
] as const satisfies readonly AppointmentStatus[];

export const createAppointmentSchema = z.object({
  patient_id: z.string().uuid("ID do paciente inválido"),
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
