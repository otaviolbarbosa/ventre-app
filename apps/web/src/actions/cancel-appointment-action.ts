"use server";

import { authActionClient } from "@/lib/safe-action";
import dayjs from "dayjs";
import { z } from "zod";

export const cancelAppointmentAction = authActionClient
  .inputSchema(
    z.object({
      appointmentId: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
      requestReschedule: z.boolean().default(false),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas pacientes podem cancelar agendamentos.");
    }

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_id, date, time, status")
      .eq("id", parsedInput.appointmentId)
      .single();

    if (!appointment?.patient_id) {
      throw new Error("Consulta não encontrada.");
    }

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("id", appointment.patient_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!patient) {
      throw new Error("Você não tem permissão para cancelar esta consulta.");
    }

    if (appointment.status === "cancelada") {
      return { success: true };
    }

    if (dayjs(`${appointment.date}T${appointment.time}`).isBefore(dayjs())) {
      throw new Error("Não é possível cancelar uma consulta que já passou.");
    }

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({
        status: "cancelada",
        cancellation_reason: parsedInput.reason || null,
        reschedule_requested: parsedInput.requestReschedule,
        cancelled_by_patient_at: new Date().toISOString(),
      })
      .eq("id", parsedInput.appointmentId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
