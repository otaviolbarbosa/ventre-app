"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";

export const disconnectGoogleCalendarAction = authActionClient.action(
  async ({ ctx: { supabaseAdmin, user } }) => {
    const { error } = await supabaseAdmin
      .from("user_google_tokens")
      .delete()
      .eq("user_id", user.id);

    if (error) throw new Error("Erro ao desconectar Google Agenda");

    revalidatePath("/profile/settings");

    await captureServerEvent(user.id, "disconnect_google_calendar");
  },
);

export const getGoogleCalendarStatusAction = authActionClient.action(
  async ({ ctx: { supabaseAdmin, user } }) => {
    const { data } = await supabaseAdmin
      .from("user_google_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    return { connected: !!data };
  },
);
