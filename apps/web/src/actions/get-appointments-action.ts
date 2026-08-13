"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import {
  APPOINTMENT_WITH_PATIENT_SELECT,
  mapAppointmentsWithPatient,
} from "@/services/appointment";
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
      .select(APPOINTMENT_WITH_PATIENT_SELECT)
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

    return {
      appointments: mapAppointmentsWithPatient(
        (appointments ?? []) as unknown as Parameters<typeof mapAppointmentsWithPatient>[0],
      ),
    };
  });
