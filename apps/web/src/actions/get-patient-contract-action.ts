"use server";

import { type ContractHeaderBlocks, buildContractHeaderBlocks } from "@/lib/contract-header-text";
import { authActionClient } from "@/lib/safe-action";
import { getPatientContractSchema } from "@/lib/validations/contract";
import {
  personalDocumentsSchema,
  type PersonalDocumentsInput,
} from "@/lib/validations/personal-documents";
import { type ContratadaAddress, getTeamMembersDetails } from "@/services/base-contract";

type TeamMember = {
  id: string;
  name: string | null;
  professional_type: string | null;
  email: string | null;
  phone: string | null;
  personal_documents: PersonalDocumentsInput | null;
  address: ContratadaAddress | null;
};

export const getPatientContractAction = authActionClient
  .inputSchema(getPatientContractSchema)
  .action(
    async ({ parsedInput: { patientId }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      const [contractResult, patientResult] = await Promise.all([
        supabase
          .from("contracts")
          .select("*")
          .eq("patient_id", patientId)
          .eq("is_base_contract", false)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("patients")
          .select("name, email, phone, date_of_birth, rg, cpf, marital_status, occupation")
          .eq("id", patientId)
          .maybeSingle(),
      ]);

      const contract = contractResult.data ?? null;
      const patient = patientResult.data;

      let signedByName: string | null = null;
      if (contract?.is_signed && contract.signed_by) {
        const { data: signer } = await supabase
          .from("users")
          .select("name")
          .eq("id", contract.signed_by)
          .maybeSingle();
        signedByName = signer?.name ?? null;
      }

      type BaseContractOption = {
        id: string;
        html: string;
        title: string;
        name: string | null;
        city: string | null;
        state: string | null;
      };

      // Fetch personal base contracts (always by user_id, enterprise_id = null)
      const { data: personalBaseRows } = await supabase
        .from("contracts")
        .select("id, clauses_html, title, name, city, state")
        .eq("is_base_contract", true)
        .eq("user_id", user.id)
        .is("enterprise_id", null)
        .order("created_at", { ascending: true });

      const personalBaseOptions: BaseContractOption[] = (personalBaseRows ?? []).map((row) => ({
        id: row.id,
        html: row.clauses_html,
        title: row.title,
        name: row.name,
        city: row.city,
        state: row.state,
      }));

      // Fetch enterprise base contracts when applicable
      let enterpriseBaseOptions: BaseContractOption[] = [];
      if (profile.enterprise_id) {
        const { data: enterpriseBaseRows } = await supabase
          .from("contracts")
          .select("id, clauses_html, title, name, city, state")
          .eq("is_base_contract", true)
          .eq("enterprise_id", profile.enterprise_id)
          .order("created_at", { ascending: true });

        enterpriseBaseOptions = (enterpriseBaseRows ?? []).map((row) => ({
          id: row.id,
          html: row.clauses_html,
          title: row.title,
          name: row.name,
          city: row.city,
          state: row.state,
        }));
      }

      // Legacy singular fields — first template in creation order, prefer enterprise.
      // Kept for patient-contract.tsx (Phase 4 migrates it to the *Options arrays).
      const enterpriseBase = enterpriseBaseOptions[0] ?? null;
      const personalBase = personalBaseOptions[0] ?? null;
      const baseContractHtml = enterpriseBase?.html ?? personalBase?.html ?? null;
      const baseTitle = enterpriseBase?.title ?? personalBase?.title ?? null;

      // Fetch pregnancy and patient-specific team members in parallel.
      // Look up by patient_id (not contract.pregnancy_id) so the due date shows up
      // even before a personal contract has been created for this patient.
      const [pregnancyResult, teamResult] = await Promise.all([
        supabase
          .from("pregnancies")
          .select("due_date, enterprise_id")
          .eq("patient_id", patientId)
          .order("has_finished", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("team_members")
          .select("users!inner(id, name, professional_type, email, phone)")
          .eq("patient_id", patientId),
      ]);

      const pregnancy = pregnancyResult.data ?? null;

      const baseTeamMembers = ((teamResult.data ?? []) as unknown[]).map(
        (r) =>
          (r as { users: Pick<TeamMember, "id" | "name" | "professional_type" | "email" | "phone"> })
            .users,
      );
      const { personalDocumentsById, addressById } = await getTeamMembersDetails(
        baseTeamMembers.map((u) => u.id),
      );
      const teamMembers: TeamMember[] = baseTeamMembers.map((u) => ({
        id: u.id,
        name: u.name,
        professional_type: u.professional_type,
        email: u.email,
        phone: u.phone,
        personal_documents: personalDocumentsById.get(u.id) ?? null,
        address: addressById.get(u.id) ?? null,
      }));

      // Build header data with patient-specific team members
      let headerBlocks = null;
      let personalHeaderBlocks = null;
      let contratadaName: string | null = null;

      if (patient) {
        if (pregnancy?.enterprise_id) {
          const { data: enterprise } = await supabaseAdmin
            .from("enterprises")
            .select(
              "name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode",
            )
            .eq("id", pregnancy.enterprise_id)
            .maybeSingle();

          headerBlocks = buildContractHeaderBlocks(patient, pregnancy, {
            type: "enterprise",
            enterprise: enterprise ?? null,
            teamMembers,
          });
          contratadaName = enterprise?.legal_name ?? enterprise?.name ?? null;
        } else {
          const [{ data: professionalAddress }, { data: professionalUser }] = await Promise.all([
            supabaseAdmin
              .from("addresses")
              .select("street, number, complement, neighborhood, city, state, zipcode")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabaseAdmin.from("users").select("personal_documents").eq("id", user.id).maybeSingle(),
          ]);

          const personalDocumentsResult = personalDocumentsSchema.safeParse(
            professionalUser?.personal_documents ?? {},
          );

          headerBlocks = buildContractHeaderBlocks(patient, pregnancy, {
            type: "autonomous",
            user: {
              name: profile.name,
              email: profile.email,
              phone: profile.phone ?? null,
              professional_type: profile.professional_type ?? null,
              personal_documents: personalDocumentsResult.success
                ? personalDocumentsResult.data
                : null,
              address: professionalAddress ?? null,
            },
          });
          contratadaName = profile.name ?? null;
        }

        // Personal header: team members listed as individual CONTRATADAS (no enterprise data)
        personalHeaderBlocks = buildContractHeaderBlocks(patient, pregnancy, {
          type: "team-personal",
          teamMembers,
        });
      }

      // Cast the Json column to ContractHeaderBlocks — shape is guaranteed by buildPatientContractParties
      const savedParties = (contract?.parties_details ?? null) as ContractHeaderBlocks | null;

      return {
        contract,
        signedByName,
        savedParties,
        baseContractHtml,
        baseTitle,
        headerBlocks,
        personalHeaderBlocks,
        patientName: patient?.name ?? null,
        contratadaName,
        enterpriseBase: enterpriseBase
          ? {
              html: enterpriseBase.html,
              title: enterpriseBase.title,
              city: enterpriseBase.city,
              state: enterpriseBase.state,
            }
          : null,
        personalBase: personalBase
          ? {
              html: personalBase.html,
              title: personalBase.title,
              city: personalBase.city,
              state: personalBase.state,
            }
          : null,
        enterpriseBaseOptions,
        personalBaseOptions,
      };
    },
  );
