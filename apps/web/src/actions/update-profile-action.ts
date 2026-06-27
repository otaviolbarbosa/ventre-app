"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  address: z
    .object({
      zipcode: z.string().optional(),
      street: z.string().optional(),
      number: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
});

export const updateProfileAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user } }) => {
    const { data: profile, error } = await supabase
      .from("users")
      .update({
        name: parsedInput.name.trim(),
        phone: parsedInput.phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error("Erro ao atualizar perfil");

    if (parsedInput.address) {
      const addr = parsedInput.address;
      const hasData = Object.values(addr).some((v) => v && v.trim().length > 0);

      if (hasData) {
        const addressPayload = {
          user_id: user.id,
          zipcode: addr.zipcode?.trim() || null,
          street: addr.street?.trim() || null,
          number: addr.number?.trim() || null,
          complement: addr.complement?.trim() || null,
          neighborhood: addr.neighborhood?.trim() || null,
          city: addr.city?.trim() || null,
          state: addr.state?.trim() || null,
          updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabaseAdmin
          .from("addresses")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          const { error: addrError } = await supabaseAdmin
            .from("addresses")
            .update(addressPayload)
            .eq("id", existing.id);
          if (addrError) throw new Error("Erro ao atualizar endereço");
        } else {
          const { error: addrError } = await supabaseAdmin.from("addresses").insert(addressPayload);
          if (addrError) throw new Error("Erro ao salvar endereço");
        }
      }
    }

    return { profile };
  });
