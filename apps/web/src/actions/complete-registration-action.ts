"use server";

import { actionClient } from "@/lib/safe-action";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID de convite inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").optional(),
  phone: z.string().optional(),
});

export const completeRegistrationAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const { inviteId, password, name: inputName, email: inputEmail, phone: inputPhone } = parsedInput;

    const supabaseAdmin = await createServerSupabaseAdmin();

    // Fetch and validate invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("registration_invites")
      .select("id, name, email, phone, professional_type, enterprise_id, expired_at, completed_at")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      throw new Error("Convite não encontrado.");
    }

    // const invite = inviteRaw as RegistrationInvite;

    if (invite.completed_at) {
      throw new Error("Convite já utilizado.");
    }

    if (new Date(invite.expired_at) < new Date()) {
      throw new Error("Convite expirado.");
    }

    const finalName = inputName ?? invite.name;
    const finalEmail = inputEmail ?? invite.email;
    const finalPhone = inputPhone ?? invite.phone;

    // Create auth user — trigger handle_new_user inserts into public.users automatically
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: { name: finalName, professional_type: invite.professional_type },
      },
    });

    if (signUpError || !signUpData.user) {
      throw new Error(signUpError?.message ?? "Erro ao criar conta.");
    }

    // Update the public.users row created by the trigger with phone and enterprise_id
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ name: finalName, phone: finalPhone, enterprise_id: invite.enterprise_id })
      .eq("id", signUpData.user.id);

    if (updateError) {
      throw new Error("Erro ao atualizar perfil.");
    }

    // Mark invite as completed
    // biome-ignore lint/suspicious/noExplicitAny: registration_invites pending pnpm db:types regen
    await (supabaseAdmin as any)
      .from("registration_invites")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", inviteId);

    return { email: finalEmail };
  });
