"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
});

export const getAppointmentsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user, profile } }) => {
    let query = supabase
      .from("appointments")
      .select(`
        *,
        patient:patients(id, name),
        professional:users!appointments_professional_id_fkey(id, name, professional_type)
      `)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!isStaff(profile)) {
      query = query.eq("professional_id", user.id);
    }

    if (parsedInput.patientId) {
      query = query.eq("patient_id", parsedInput.patientId);
    }

    if (parsedInput.professionalId) {
      query = query.eq("professional_id", parsedInput.professionalId);
    }

    const { data: appointments, error } = await query.eq("status", "agendada");

    if (error) throw new Error(error.message);

    return { appointments: appointments ?? [] };
  });
