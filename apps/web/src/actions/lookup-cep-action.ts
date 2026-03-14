"use server";

import { actionClient } from "@/lib/safe-action";
import { z } from "zod";

type CepResult = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
};

export const lookupCepAction = actionClient
  .inputSchema(z.object({ cep: z.string().min(8).max(9) }))
  .action(async ({ parsedInput: { cep } }): Promise<CepResult> => {
    const digits = cep.replace(/\D/g, "");

    if (digits.length !== 8) {
      throw new Error("CEP deve ter 8 dígitos");
    }

    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error("CEP não encontrado");
    }

    const data = await response.json();

    return {
      cep: data.cep,
      state: data.state ?? "",
      city: data.city ?? "",
      neighborhood: data.neighborhood ?? "",
      street: data.street ?? "",
    };
  });
