"use server";

import { isStaff } from "@/lib/access-control";
import { sendProfessionalInvite } from "@/lib/emails/send-professional-invite";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(10, "Telefone inválido"),
  professional_type: z.enum(["obstetra", "enfermeiro", "doula"]),
});

export const addNewProfessionalAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");
    if (!profile.enterprise_id) throw new Error("Você não está associado a nenhuma organização.");

    const { name, email, phone, professional_type } = parsedInput;
    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, enterprise_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing?.enterprise_id) {
      throw new Error("Esta profissional já está vinculada a uma organização.");
    }

    if (existing) {
      // User already has an auth account — just update the profile, no invite needed
      await supabaseAdmin
        .from("users")
        .update({ phone, enterprise_id: profile.enterprise_id })
        .eq("id", existing.id);

      return { name, email: normalizedEmail };
    }

    // New user — check for existing pending invite
    const { data: pendingInvite } = await supabaseAdmin
      .from("registration_invites")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("enterprise_id", profile.enterprise_id)
      .is("completed_at", null)
      .gt("expired_at", new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      throw new Error("Já existe um convite pendente para este e-mail.");
    }

    const { data: enterprise } = await supabaseAdmin
      .from("enterprises")
      .select("name")
      .eq("id", profile.enterprise_id)
      .single();

    const enterpriseName = enterprise?.name ?? "Sua clínica";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    // Insert invite record
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("registration_invites")
      .insert({
        name,
        email: normalizedEmail,
        phone,
        professional_type,
        invited_by: profile.id,
        enterprise_id: profile.enterprise_id,
      })
      .select("id")
      .single();

    if (inviteError || !invite) {
      throw new Error("Erro ao criar convite de registro.");
    }

    const inviteLink = `${appUrl}/complete-registration?riid=${invite.id}`;

    await sendProfessionalInvite({
      to: normalizedEmail,
      name,
      enterpriseName,
      professional_type,
      inviteLink,
    });

    return { name, email: normalizedEmail };
  });
