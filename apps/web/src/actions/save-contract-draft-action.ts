"use server";

import { authActionClient } from "@/lib/safe-action";
import { savePatientContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveContractDraftAction = authActionClient
  .inputSchema(savePatientContractSchema)
  .action(
    async ({
      parsedInput: { patientId, pregnancyId, title, clauses_html, city, state },
      ctx: { supabase, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, status")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .in("status", ["draft", "active"])
        .maybeSingle();

      if (existing?.status === "active") {
        throw new Error(
          "Este contrato já foi gerado — use 'Editar contrato' em vez de salvar rascunho.",
        );
      }

      let contractId: string;

      if (existing?.id) {
        const { error } = await supabase
          .from("contracts")
          .update({ title, clauses_html, city: city ?? null, state: state ?? null })
          .eq("id", existing.id);
        if (error) throw new Error("Erro ao salvar rascunho. Tente novamente.");
        contractId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            status: "draft",
            title,
            clauses_html,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();

        if (error?.code === "23505") {
          throw new Error("Já existe um contrato em andamento para esta gestante.");
        }
        if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar rascunho.");
        contractId = inserted.id;
      }

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      return { contractId };
    },
  );
