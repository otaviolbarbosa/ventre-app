"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({});

export const getSubscriptionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ ctx: { supabase, profile } }) => {
    let query = supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .order("created_at", { ascending: false })
      .limit(1);

    if (profile.enterprise_id) {
      query = query.eq("enterprise_id", profile.enterprise_id);
    } else {
      query = query.eq("user_id", profile.id);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw new Error(error.message);

    return { subscription: subscriptions?.[0] ?? null };
  });
