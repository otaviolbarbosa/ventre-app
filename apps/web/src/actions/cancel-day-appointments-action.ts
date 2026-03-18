"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const cancelDayAppointmentsAction = authActionClient
  .inputSchema(z.object({ date: z.string() }))
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelada" })
      .eq("date", parsedInput.date)
      .eq("status", "agendada")
      .eq("professional_id", user.id);

    if (error) throw new Error(error.message);
  });
