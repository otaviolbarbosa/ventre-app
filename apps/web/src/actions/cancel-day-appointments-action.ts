"use server";

import { z } from "zod";
import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { syncDeleteToGoogleCalendar } from "@/services/google-calendar";

export const cancelDayAppointmentsAction = authActionClient
  .inputSchema(
    z.object({
      date: z.string(),
      appointmentIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    // Fetch appointments with google_event_id before cancelling so we can delete GCal events
    let fetchQuery = supabase
      .from("appointments")
      .select("id, google_event_id")
      .eq("status", "agendada")
      .eq("date", parsedInput.date);

    if (!isStaff(profile)) {
      fetchQuery = fetchQuery.eq("professional_id", user.id);
    }

    if (parsedInput.appointmentIds && parsedInput.appointmentIds.length > 0) {
      fetchQuery = fetchQuery.in("id", parsedInput.appointmentIds);
    }

    const { data: appointmentsToCancel } = await fetchQuery;

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

    // Fire-and-forget GCal deletes for appointments that had calendar events
    for (const appt of appointmentsToCancel ?? []) {
      if (appt.google_event_id) {
        syncDeleteToGoogleCalendar(appt.google_event_id, user.id).catch((err) => {
          console.error("[google-calendar] delete sync failed", err);
        });
      }
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Agendamentos do dia cancelados",
        description: `Agendamentos do dia ${parsedInput.date} cancelados`,
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        metadata: { date: parsedInput.date },
      });
    }
  });
