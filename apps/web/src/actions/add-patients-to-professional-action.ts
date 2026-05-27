"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  professionalId: z.string().uuid(),
  professionalType: z.enum(["obstetra", "enfermeiro", "doula"]),
  patientIds: z.array(z.string().uuid()).min(1),
});

export const addPatientsToProfessionalAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");

    const { professionalId, professionalType, patientIds } = parsedInput;

    const { data: pregnancies } = await supabaseAdmin
      .from("pregnancies")
      .select("id, patient_id")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    const pregnancyByPatient = new Map<string, string>();
    for (const preg of pregnancies ?? []) {
      if (!pregnancyByPatient.has(preg.patient_id)) {
        pregnancyByPatient.set(preg.patient_id, preg.id);
      }
    }

    const inserts = patientIds
      .filter((id) => pregnancyByPatient.has(id))
      .map((patientId) => ({
        patient_id: patientId,
        professional_id: professionalId,
        professional_type: professionalType,
        is_backup: false,
        pregnancy_id: pregnancyByPatient.get(patientId) as string,
      }));

    if (inserts.length === 0) throw new Error("Nenhuma paciente com gestação registrada");

    const { error } = await supabaseAdmin.from("team_members").insert(inserts);
    if (error) throw new Error(error.message);

    return { successCount: inserts.length };
  });
