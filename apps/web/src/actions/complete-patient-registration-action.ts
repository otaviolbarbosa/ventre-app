"use server";

import { actionClient } from "@/lib/safe-action";
import { createPatientWithTeamAndBilling } from "@/services/patient-onboarding";
import type { CreatePatientInput } from "@/lib/validations/patient";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID de convite inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").optional(),
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

export const completePatientRegistrationAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const { inviteId, password, name: inputName, email: inputEmail, phone: inputPhone } =
      parsedInput;

    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("patient_invite_links")
      .select("id, invite_type, name, email, phone, patient_id, enterprise_id, metadata, expires_at, used_at")
      .eq("id", inviteId)
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

    const finalName = inputName ?? invite.name ?? "";
    const finalEmail = inputEmail ?? invite.email ?? "";
    const finalPhone = inputPhone ?? invite.phone ?? "";

    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: { name: finalName, user_type: "patient" },
      },
    });

    if (signUpError || !signUpData.user) {
      throw new Error(signUpError?.message ?? "Erro ao criar conta.");
    }

    const userId = signUpData.user.id;

    if (invite.invite_type === "new_patient") {
      const metadata = invite.metadata as {
        professional_ids?: string[];
        backup_professional_ids?: string[];
        billing?: CreatePatientInput["billing"];
      };

      if (!parsedInput.due_date || !parsedInput.dum) {
        throw new Error("Dados da gestação são obrigatórios.");
      }

      const patientInput: CreatePatientInput = {
        name: finalName,
        email: finalEmail,
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

      const responsibleProfessionalId = metadata.professional_ids?.[0];
      if (!responsibleProfessionalId) {
        throw new Error("Convite inválido: nenhuma profissional responsável definida.");
      }

      const { patient } = await createPatientWithTeamAndBilling(
        supabaseAdmin,
        supabaseAdmin,
        responsibleProfessionalId,
        patientInput,
        invite.enterprise_id,
      );

      const { error: linkError } = await supabaseAdmin
        .from("patients")
        .update({ user_id: userId })
        .eq("id", patient.id);

      if (linkError) {
        throw new Error("Erro ao vincular conta à paciente.");
      }

      await supabaseAdmin
        .from("patient_invite_links")
        .update({ used_at: new Date().toISOString(), patient_id: patient.id })
        .eq("id", inviteId);
    } else {
      if (!invite.patient_id) {
        throw new Error("Convite inválido.");
      }

      const { error: linkError } = await supabaseAdmin
        .from("patients")
        .update({ user_id: userId, phone: finalPhone })
        .eq("id", invite.patient_id);

      if (linkError) {
        throw new Error("Erro ao vincular conta à paciente.");
      }

      await supabaseAdmin
        .from("patient_invite_links")
        .update({ used_at: new Date().toISOString() })
        .eq("id", inviteId);
    }

    return { email: finalEmail };
  });
