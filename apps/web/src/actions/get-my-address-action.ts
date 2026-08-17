"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({});

export const getMyAddressAction = authActionClient
  .inputSchema(schema)
  .action(async ({ ctx: { supabaseAdmin, user } }) => {
    const { data: address } = await supabaseAdmin
      .from("addresses")
      .select("zipcode, street, number, complement, neighborhood, city, state")
      .eq("user_id", user.id)
      .maybeSingle();

    return { address: address ?? null };
  });
