"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  professionalId: z.string().uuid(),
});

export const getPatientsNotInProfessionalTeamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");
    if (!profile.enterprise_id) throw new Error("Organização não encontrada");

    const [{ data: enterprisePregnancies }, { data: professional }] = await Promise.all([
      supabaseAdmin
        .from("pregnancies")
        .select("patient_id")
        .eq("enterprise_id", profile.enterprise_id)
        .eq("has_finished", false),
      supabaseAdmin
        .from("users")
        .select("professional_type")
        .eq("id", parsedInput.professionalId)
        .single(),
    ]);

    const allPatientIds = [...new Set(enterprisePregnancies?.map((p) => p.patient_id) ?? [])];
    if (allPatientIds.length === 0) return { patients: [] };

    // Patients already assigned to this professional
    const { data: professionalTeamMembers } = await supabaseAdmin
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", parsedInput.professionalId);

    const assignedPatientIds = new Set(professionalTeamMembers?.map((tm) => tm.patient_id) ?? []);

    // Patients that already have a titular professional of the same type
    const sameTypeOccupiedIds = new Set<string>();
    if (professional?.professional_type) {
      const { data: sameTypeMembers } = await supabaseAdmin
        .from("team_members")
        .select("patient_id")
        .eq("professional_type", professional.professional_type)
        .eq("is_backup", false)
        .in("patient_id", allPatientIds);

      for (const tm of sameTypeMembers ?? []) {
        sameTypeOccupiedIds.add(tm.patient_id);
      }
    }

    const availablePatientIds = allPatientIds.filter(
      (id) => !assignedPatientIds.has(id) && !sameTypeOccupiedIds.has(id),
    );
    if (availablePatientIds.length === 0) return { patients: [] };

    const [{ data: patients, error }, { data: pregnancies }] = await Promise.all([
      supabaseAdmin.from("patients").select("id, name").in("id", availablePatientIds).order("name"),
      supabaseAdmin
        .from("pregnancies")
        .select("patient_id, due_date, dum")
        .eq("has_finished", false)
        .in("patient_id", availablePatientIds)
        .order("created_at", { ascending: false }),
    ]);

    if (error) throw new Error(error.message);

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));

    const result = (patients ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
      dum: pregnancyByPatient.get(p.id)?.dum ?? null,
    }));

    return { patients: result };
  });
