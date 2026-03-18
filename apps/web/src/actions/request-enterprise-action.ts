"use server";

import { authActionClient } from "@/lib/safe-action";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  professionals_amount: z.number().int().default(5),
});

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const requestEnterpriseAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, user } }) => {
    const slug = generateSlug(parsedInput.name);
    const token = generateToken();

    const { data: enterprise, error } = await supabaseAdmin
      .from("enterprises")
      .insert({
        name: parsedInput.name,
        slug,
        token,
        legal_name: parsedInput.legal_name || null,
        cnpj: parsedInput.cnpj || null,
        email: parsedInput.email || null,
        phone: parsedInput.phone || null,
        whatsapp: parsedInput.whatsapp || null,
        street: parsedInput.street || null,
        number: parsedInput.number || null,
        complement: parsedInput.complement || null,
        neighborhood: parsedInput.neighborhood || null,
        city: parsedInput.city || null,
        state: parsedInput.state || null,
        zipcode: parsedInput.zipcode || null,
        professionals_amount: parsedInput.professionals_amount,
        is_active: false,
      })
      .select("id")
      .single();

    if (error || !enterprise) {
      throw new Error("Erro ao solicitar criação da organização. Tente novamente.");
    }

    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ user_type: "manager", enterprise_id: enterprise.id })
      .eq("id", user.id);

    if (userError) {
      throw new Error(userError.message);
    }

    redirect("/home");
  });
