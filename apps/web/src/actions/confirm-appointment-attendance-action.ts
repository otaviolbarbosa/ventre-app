"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const confirmAppointmentAttendanceAction = authActionClient
  .inputSchema(z.object({ appointmentId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas pacientes podem confirmar presença.");
    }

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_id")
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
      throw new Error("Você não tem permissão para confirmar esta consulta.");
    }

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ confirmed_by_patient_at: new Date().toISOString() })
      .eq("id", parsedInput.appointmentId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
