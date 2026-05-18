"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { createAppointment } from "@/services/appointment";
import { syncCreateToGoogleCalendar } from "@/services/google-calendar";
import type { Patient } from "@/types";

export const addAppointmentAction = authActionClient
  .inputSchema(createAppointmentSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const professionalId =
      isStaff(profile) && parsedInput.professional_id ? parsedInput.professional_id : user.id;
    const appointment = await createAppointment(supabaseAdmin, professionalId, parsedInput);

    let patientName: string | null = parsedInput.external_patient_name ?? null;
    if (!parsedInput.is_external && appointment.patient_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", appointment.patient_id)
        .single();

      patientName = patient?.name ?? null;
    }

    if (profile.enterprise_id) {
      const isConsulta = parsedInput.type === "consulta";
      const actionName = isConsulta ? "Nova consulta agendada" : "Novo encontro agendado";
      const typeLabel = isConsulta ? "Consulta pré-natal" : "Encontro preparatório";

      const description = patientName
        ? `${typeLabel} para ${patientName} em ${appointment.date} às ${appointment.time.slice(0, 5)}`
        : `${typeLabel} agendado para ${appointment.date}`;

      insertActivityLog({
        supabaseAdmin,
        actionName,
        description,
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: appointment.patient_id ?? undefined,
        metadata: { appointment_id: appointment.id, type: parsedInput.type },
      });
    }

    // Fire-and-forget — GCal failure must not break appointment creation
    syncCreateToGoogleCalendar(
      appointment,
      { id: appointment.patient_id, name: patientName } as Patient,
      user.id,
    ).catch((err) => {
      console.error("[google-calendar] create sync failed", err);
    });

    return { appointment };
  });
