"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const createLinkExistingPatientInviteAction = authActionClient
  .inputSchema(z.object({ patientId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user } }) => {
    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("patient_id", parsedInput.patientId)
      .eq("professional_id", user.id)
      .maybeSingle();

    if (!membership) {
      throw new Error("Você não tem permissão para convidar esta paciente.");
    }

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, name, email, phone, user_id")
      .eq("id", parsedInput.patientId)
      .single();

    if (!patient) {
      throw new Error("Paciente não encontrada.");
    }

    if (patient.user_id) {
      throw new Error("Paciente já possui conta.");
    }

    const { data: invite, error } = await supabaseAdmin
      .from("patient_invite_links")
      .insert({
        invite_type: "link_existing",
        patient_id: patient.id,
        created_by: user.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { invite };
  });
