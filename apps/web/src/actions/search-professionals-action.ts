"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export type ProfessionalSearchResult = {
  id: string;
  name: string;
  email: string;
  professional_type: string | null;
  avatar_url: string | null;
};

export const searchProfessionalsAction = authActionClient
  .inputSchema(z.object({ query: z.string().min(1) }))
  .action(async ({ parsedInput: { query }, ctx: { supabaseAdmin, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");

    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }

    const trimmed = query.trim();

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, professional_type, avatar_url")
      .eq("user_type", "professional")
      .is("enterprise_id", null)
      .or(`name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
      .limit(10);

    if (error) {
      throw new Error("Erro ao buscar profissionais.");
    }

    return { professionals: (data ?? []) as ProfessionalSearchResult[] };
  });
