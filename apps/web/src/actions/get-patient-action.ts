"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const getPatientAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { data: patient, error } = await supabase
      .from("patients")
      .select(
        "*, pregnancies(id, due_date, dum, has_finished, born_at, delivery_method, observations, created_at, updated_at, patient_id)",
      )
      .eq("id", parsedInput.patientId)
      .single();

    if (error) throw new Error(error.message);

    const pregnancy =
      patient?.pregnancies.length === 0
        ? null
        : // Caso a paciente esteja gravida, retornar dados da gestação ativa
          (patient?.pregnancies.filter((pregnancy) => !pregnancy.has_finished).at(0) ??
          // Caso a paciente não esteja grávida, retornar dados da última gestação ativa
          patient.pregnancies.at(-1));

    return {
      patient: {
        ...patient,
        pregnancies: undefined,
        due_date: pregnancy?.due_date ?? null,
        dum: pregnancy?.dum ?? null,
        has_finished: pregnancy?.has_finished ?? false,
        born_at: pregnancy?.born_at ?? null,
        delivery_method: pregnancy?.delivery_method ?? null,
        observations: pregnancy?.observations ?? null,
      },
      pregnancy,
    };
  });
