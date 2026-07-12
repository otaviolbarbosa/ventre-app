"use server";

import { authActionClient } from "@/lib/safe-action";
import type { CreatePatientInput } from "@/lib/validations/patient";
import { createPatientWithTeamAndBilling } from "@/services/patient-onboarding";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID de convite inválido"),
  phone: z.string().optional(),
  // Type 1 (new_patient) fields
  partner_name: z.string().optional(),
  due_date: z.string().optional(),
  dum: z.string().optional(),
  baby_name: z.string().optional(),
  observations: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      complement: z.string().optional(),
      number: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
    })
    .optional(),
});

export const completePatientRegistrationPostOAuthAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Conta inválida para este fluxo.");
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("patient_invite_links")
      .select("id, invite_type, name, email, phone, patient_id, enterprise_id, metadata, expires_at, used_at")
      .eq("id", parsedInput.inviteId)
      .single();

    if (inviteError || !invite) {
      throw new Error("Convite não encontrado.");
    }

    if (invite.used_at) {
      throw new Error("Convite já utilizado.");
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error("Convite expirado.");
    }

    const finalPhone = parsedInput.phone ?? invite.phone ?? "";

    if (invite.invite_type === "new_patient") {
      const metadata = invite.metadata as {
        professional_ids?: string[];
        backup_professional_ids?: string[];
        billing?: CreatePatientInput["billing"];
      };

      if (!parsedInput.due_date || !parsedInput.dum) {
        throw new Error("Dados da gestação são obrigatórios.");
      }

      const responsibleProfessionalId = metadata.professional_ids?.[0];
      if (!responsibleProfessionalId) {
        throw new Error("Convite inválido: nenhuma profissional responsável definida.");
      }

      const patientInput: CreatePatientInput = {
        name: user.user_metadata?.name ?? invite.name ?? "",
        email: invite.email ?? user.email ?? "",
        phone: finalPhone,
        partner_name: parsedInput.partner_name,
        baby_name: parsedInput.baby_name,
        due_date: parsedInput.due_date,
        dum: parsedInput.dum,
        observations: parsedInput.observations,
        address: parsedInput.address,
        professional_ids: metadata.professional_ids,
        backup_professional_ids: metadata.backup_professional_ids,
        billing: metadata.billing,
      };

      const { patient } = await createPatientWithTeamAndBilling(
        supabaseAdmin,
        supabaseAdmin,
        responsibleProfessionalId,
        patientInput,
        invite.enterprise_id,
      );

      await supabaseAdmin.from("patients").update({ user_id: user.id }).eq("id", patient.id);

      await supabaseAdmin
        .from("patient_invite_links")
        .update({ used_at: new Date().toISOString(), patient_id: patient.id })
        .eq("id", parsedInput.inviteId);
    } else {
      if (!invite.patient_id) {
        throw new Error("Convite inválido.");
      }

      await supabaseAdmin
        .from("patients")
        .update({ user_id: user.id, phone: finalPhone })
        .eq("id", invite.patient_id);

      await supabaseAdmin
        .from("patient_invite_links")
        .update({ used_at: new Date().toISOString() })
        .eq("id", parsedInput.inviteId);
    }

    return { success: true };
  });
