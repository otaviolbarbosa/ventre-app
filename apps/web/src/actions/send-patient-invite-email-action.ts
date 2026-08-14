"use server";

import { authActionClient } from "@/lib/safe-action";
import { sendPatientInvite } from "@/lib/emails/send-patient-invite";
import { z } from "zod";

const sendPatientInviteEmailSchema = z.object({
  inviteId: z.string().uuid(),
});

export const sendPatientInviteEmailAction = authActionClient
  .inputSchema(sendPatientInviteEmailSchema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin } }) => {
    const { data: invite, error } = await supabaseAdmin
      .from("patient_invite_links")
      .select("id, name, email, enterprise_id, enterprises(name)")
      .eq("id", parsedInput.inviteId)
      .single();

    if (error || !invite) {
      throw new Error("Convite não encontrado.");
    }

    if (!invite.email) {
      throw new Error("Este convite não possui e-mail cadastrado.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inviteLink = `${appUrl}/patient-registration?piid=${invite.id}`;

    await sendPatientInvite({
      to: invite.email,
      name: invite.name ?? "Gestante",
      enterpriseName: invite.enterprises?.name,
      inviteLink,
    });

    return { success: true };
  });
