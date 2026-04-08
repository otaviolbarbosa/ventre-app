"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({});

export const getSubscriptionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ ctx: { supabase, profile } }) => {
    const orFilter = profile.enterprise_id
      ? `user_id.eq.${profile.id},enterprise_id.eq.${profile.enterprise_id}`
      : `user_id.eq.${profile.id}`;

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);

    return { subscription: subscriptions?.[0] ?? null };
  });
