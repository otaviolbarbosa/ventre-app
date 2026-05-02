"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { createAppointment } from "@/services/appointment";

export const addAppointmentAction = authActionClient
  .inputSchema(createAppointmentSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const professionalId =
      isStaff(profile) && parsedInput.professional_id ? parsedInput.professional_id : user.id;
    const appointment = await createAppointment(supabase, professionalId, parsedInput);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", appointment.patient_id)
        .single();

      const isConsulta = parsedInput.type === "consulta";
      const actionName = isConsulta ? "Nova consulta agendada" : "Novo encontro agendado";
      const typeLabel = isConsulta ? "Consulta pré-natal" : "Encontro preparatório";
      const description = patient
        ? `${typeLabel} para ${patient.name} em ${appointment.date} às ${appointment.time.slice(0, 5)}`
        : `${typeLabel} agendado para ${appointment.date}`;

      insertActivityLog({
        supabaseAdmin,
        actionName,
        description,
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: appointment.patient_id,
        metadata: { appointment_id: appointment.id, type: parsedInput.type },
      });
    }

    return { appointment };
  });
