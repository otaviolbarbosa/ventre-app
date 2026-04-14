"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const cancelDayAppointmentsAction = authActionClient
  .inputSchema(
    z.object({
      date: z.string(),
      appointmentIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabase, user, profile } }) => {
    let query = supabase
      .from("appointments")
      .update({ status: "cancelada" })
      .eq("status", "agendada")
      .eq("date", parsedInput.date);

    if (!isStaff(profile)) {
      query = query.eq("professional_id", user.id);
    }

    if (parsedInput.appointmentIds && parsedInput.appointmentIds.length > 0) {
      query = query.in("id", parsedInput.appointmentIds);
    }

    const { error } = await query;

    if (error) throw new Error(error.message);
  });
