"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { createAppointment } from "@/services/appointment";

export const addAppointmentAction = authActionClient
  .inputSchema(createAppointmentSchema)
  .action(async ({ parsedInput, ctx: { supabase, user, profile } }) => {
    const professionalId =
      isStaff(profile) && parsedInput.professional_id ? parsedInput.professional_id : user.id;
    const appointment = await createAppointment(supabase, professionalId, parsedInput);
    return { appointment };
  });
