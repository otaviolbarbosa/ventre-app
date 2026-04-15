"use server";

import { authActionClient } from "@/lib/safe-action";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { z } from "zod";

export const updateAppointmentAction = authActionClient
  .inputSchema(
    updateAppointmentSchema.extend({
      id: z.string().uuid(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { id, ...fields } = parsedInput;

    const { error } = await supabase
      .from("appointments")
      .update(fields)
      .eq("id", id);

    if (error) throw new Error(error.message);
  });
