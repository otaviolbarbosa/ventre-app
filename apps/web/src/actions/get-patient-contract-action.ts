"use server";

import { buildContractHeaderBlocks, type ContractHeaderBlocks } from "@/lib/contract-header-text";
import { authActionClient } from "@/lib/safe-action";
import { getPatientContractSchema } from "@/lib/validations/contract";

type TeamMember = {
  id: string;
  name: string | null;
  professional_type: string | null;
  email: string | null;
  phone: string | null;
};

export const getPatientContractAction = authActionClient
  .inputSchema(getPatientContractSchema)
  .action(async ({ parsedInput: { patientId }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
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
        .select("name, email, phone, date_of_birth")
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

    // Fetch personal base contract (always by user_id, enterprise_id = null)
    const { data: personalBase } = await supabase
      .from("contracts")
      .select("clauses_html, title, city, state")
      .eq("is_base_contract", true)
      .eq("user_id", user.id)
      .is("enterprise_id", null)
      .maybeSingle();

    // Fetch enterprise base contract when applicable
    let enterpriseBase: { clauses_html: string; title: string; city: string | null; state: string | null } | null =
      null;
    if (profile.enterprise_id) {
      const { data: base } = await supabase
        .from("contracts")
        .select("clauses_html, title, city, state")
        .eq("is_base_contract", true)
        .eq("enterprise_id", profile.enterprise_id)
        .maybeSingle();
      enterpriseBase = base ?? null;
    }

    // Legacy fields: prefer enterprise base for enterprise users, else personal
    const baseContractHtml = enterpriseBase?.clauses_html ?? personalBase?.clauses_html ?? null;
    const baseTitle = enterpriseBase?.title ?? personalBase?.title ?? null;

    // Fetch pregnancy and patient-specific team members in parallel
    const pregnancyId = contract?.pregnancy_id ?? null;
    const [pregnancyResult, teamResult] = await Promise.all([
      pregnancyId
        ? supabase.from("pregnancies").select("due_date").eq("id", pregnancyId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("team_members")
        .select("users!inner(id, name, professional_type, email, phone)")
        .eq("patient_id", patientId),
    ]);

    const pregnancy = pregnancyResult.data ?? null;

    const teamMembers: TeamMember[] = ((teamResult.data ?? []) as unknown[]).map((r) => {
      const u = (r as { users: TeamMember }).users;
      return { id: u.id, name: u.name, professional_type: u.professional_type, email: u.email, phone: u.phone };
    });

    // Build header data with patient-specific team members
    let headerBlocks = null;
    let personalHeaderBlocks = null;
    let contratadaName: string | null = null;

    if (patient) {
      if (profile.enterprise_id) {
        const { data: enterprise } = await supabaseAdmin
          .from("enterprises")
          .select(
            "name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode",
          )
          .eq("id", profile.enterprise_id)
          .maybeSingle();

        headerBlocks = buildContractHeaderBlocks(
          patient,
          pregnancy,
          { type: "enterprise", enterprise: enterprise ?? null, teamMembers },
        );
        contratadaName = enterprise?.legal_name ?? enterprise?.name ?? null;
      } else {
        headerBlocks = buildContractHeaderBlocks(
          patient,
          pregnancy,
          {
            type: "autonomous",
            user: {
              name: profile.name,
              email: profile.email,
              phone: profile.phone ?? null,
              professional_type: profile.professional_type ?? null,
            },
          },
        );
        contratadaName = profile.name ?? null;
      }

      // Personal header: team members listed as individual CONTRATADAS (no enterprise data)
      personalHeaderBlocks = buildContractHeaderBlocks(
        patient,
        pregnancy,
        { type: "team-personal", teamMembers },
      );
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
            html: enterpriseBase.clauses_html,
            title: enterpriseBase.title,
            city: enterpriseBase.city,
            state: enterpriseBase.state,
          }
        : null,
      personalBase: personalBase
        ? {
            html: personalBase.clauses_html,
            title: personalBase.title,
            city: personalBase.city,
            state: personalBase.state,
          }
        : null,
    };
  });
