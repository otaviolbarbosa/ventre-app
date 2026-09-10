"use server";

import { buildContractHeaderBlocks } from "@/lib/contract-header-text";
import { authActionClient } from "@/lib/safe-action";
import { personalDocumentsSchema } from "@/lib/validations/personal-documents";
import { getTeamMembersDetails } from "@/services/base-contract";
import { z } from "zod";

// Drafts never have `parties_details` saved (that snapshot is only taken when the
// contract is generated), so the patient's draft preview builds the header blocks
// live from the contratada identity stored on the draft row itself
// (contract.enterprise_id / contract.user_id) — mirroring what
// getPatientContractAction does for the professional's own view.
export const getMyDraftContractHeaderAction = authActionClient
  .inputSchema(z.object({ patientId: z.string().uuid() }))
  .action(
    async ({ parsedInput: { patientId }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      if (profile.user_type !== "patient") {
        throw new Error("Apenas a gestante pode visualizar esta pré-visualização.");
      }

      const { data: patientRow } = await supabase
        .from("patients")
        .select(
          "id, user_id, name, email, phone, date_of_birth, rg, cpf, marital_status, occupation",
        )
        .eq("id", patientId)
        .maybeSingle();

      if (!patientRow || patientRow.user_id !== user.id) {
        throw new Error("Você não tem permissão para visualizar este contrato.");
      }

      const { data: contract } = await supabase
        .from("contracts")
        .select("id, enterprise_id, user_id")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("status", "draft")
        .maybeSingle();

      if (!contract) throw new Error("Nenhum rascunho encontrado.");

      const { data: pregnancy } = await supabaseAdmin
        .from("pregnancies")
        .select("due_date")
        .eq("patient_id", patientId)
        .order("has_finished", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: teamRows } = await supabaseAdmin
        .from("team_members")
        .select("users!inner(id, name, professional_type, email, phone)")
        .eq("patient_id", patientId);

      const baseTeamMembers = ((teamRows ?? []) as unknown[]).map(
        (r) =>
          (
            r as {
              users: {
                id: string;
                name: string | null;
                professional_type: string | null;
                email: string | null;
                phone: string | null;
              };
            }
          ).users,
      );
      const { personalDocumentsById, addressById } = await getTeamMembersDetails(
        baseTeamMembers.map((u) => u.id),
      );
      const teamMembers = baseTeamMembers.map((u) => ({
        id: u.id,
        name: u.name,
        professional_type: u.professional_type,
        email: u.email,
        phone: u.phone,
        personal_documents: personalDocumentsById.get(u.id) ?? null,
        address: addressById.get(u.id) ?? null,
      }));

      let headerBlocks: ReturnType<typeof buildContractHeaderBlocks> | null = null;
      let contratadaName: string | null = null;

      if (contract.enterprise_id) {
        const { data: enterprise } = await supabaseAdmin
          .from("enterprises")
          .select(
            "name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode",
          )
          .eq("id", contract.enterprise_id)
          .maybeSingle();

        headerBlocks = buildContractHeaderBlocks(patientRow, pregnancy ?? null, {
          type: "enterprise",
          enterprise: enterprise ?? null,
          teamMembers,
        });
        contratadaName = enterprise?.legal_name ?? enterprise?.name ?? null;
      } else if (contract.user_id) {
        const [{ data: professionalAddress }, { data: professionalUser }] = await Promise.all([
          supabaseAdmin
            .from("addresses")
            .select("street, number, complement, neighborhood, city, state, zipcode")
            .eq("user_id", contract.user_id)
            .maybeSingle(),
          supabaseAdmin
            .from("users")
            .select("name, email, phone, professional_type, personal_documents")
            .eq("id", contract.user_id)
            .maybeSingle(),
        ]);

        const personalDocumentsResult = personalDocumentsSchema.safeParse(
          professionalUser?.personal_documents ?? {},
        );

        headerBlocks = buildContractHeaderBlocks(patientRow, pregnancy ?? null, {
          type: "autonomous",
          user: {
            name: professionalUser?.name ?? null,
            email: professionalUser?.email ?? null,
            phone: professionalUser?.phone ?? null,
            professional_type: professionalUser?.professional_type ?? null,
            personal_documents: personalDocumentsResult.success
              ? personalDocumentsResult.data
              : null,
            address: professionalAddress ?? null,
          },
        });
        contratadaName = professionalUser?.name ?? null;
      }

      if (!headerBlocks) throw new Error("Não foi possível montar os dados do contrato.");

      return {
        headerBlocks,
        patientName: patientRow.name ?? null,
        contratadaName,
      };
    },
  );
