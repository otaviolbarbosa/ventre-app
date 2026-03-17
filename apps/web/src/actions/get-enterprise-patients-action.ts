"use server";

import type { PatientWithPregnancyFields } from "@/services/patient";
import type { PatientFilter, TeamMember } from "@/types";
import { createServerSupabaseClient } from "@nascere/supabase/server";

const PATIENTS_PER_PAGE = 10;

type GetEnterprisePatientsResult = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  teamMembersMap: Record<string, TeamMember[]>;
  error?: string;
};

export async function getEnterpriseDueDates(
  enterpriseId: string,
  professionalId?: string | null,
): Promise<{ due_date: string | null }[]> {
  const supabase = await createServerSupabaseClient();
  let teamMembersQuery = supabase.from("team_members").select("patient_id");
  if (professionalId) {
    teamMembersQuery = teamMembersQuery.eq("professional_id", professionalId);
  } else {
    const { data: professionals } = await supabase
      .from("users")
      .select("id")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional");
    const professionalIds = professionals?.map((p) => p.id) ?? [];
    if (professionalIds.length === 0) return [];
    teamMembersQuery = teamMembersQuery.in("professional_id", professionalIds);
  }
  const { data: memberships } = await teamMembersQuery;
  const patientIds = [...new Set(memberships?.map((tm) => tm.patient_id) ?? [])];
  if (patientIds.length === 0) return [];
  const { data } = await supabase.from("pregnancies").select("due_date").in("patient_id", patientIds);
  return (data ?? []).map((p) => ({ due_date: p.due_date ?? null }));
}

export async function getEnterprisePatients(
  enterpriseId: string,
  filter: PatientFilter = "all",
  search = "",
  page = 1,
  professionalId?: string,
  dppMonth?: number,
  dppYear?: number,
): Promise<GetEnterprisePatientsResult> {
  const supabase = await createServerSupabaseClient();

  let teamMembersQuery = supabase.from("team_members").select("patient_id");

  if (professionalId) {
    teamMembersQuery = teamMembersQuery.eq("professional_id", professionalId);
  } else {
    const { data: professionals } = await supabase
      .from("users")
      .select("id")
      .eq("enterprise_id", enterpriseId)
      .eq("user_type", "professional");

    const professionalIds = professionals?.map((p) => p.id) ?? [];

    if (professionalIds.length === 0) {
      return { patients: [], totalCount: 0, teamMembersMap: {} };
    }

    teamMembersQuery = teamMembersQuery.in("professional_id", professionalIds);
  }

  const { data: teamMembershipsData } = await teamMembersQuery;

  const patientIds = [...new Set(teamMembershipsData?.map((tm) => tm.patient_id) ?? [])];

  if (patientIds.length === 0) {
    return { patients: [], totalCount: 0, teamMembersMap: {} };
  }

  let rows: PatientWithPregnancyFields[] = [];
  let totalCount = 0;

  if (dppMonth !== undefined && dppYear !== undefined) {
    // DPP filter path: query pregnancies directly
    const month1Indexed = dppMonth + 1;
    const startDate = `${dppYear}-${String(month1Indexed).padStart(2, "0")}-01`;
    const lastDay = new Date(dppYear, dppMonth + 1, 0).getDate();
    const endDate = `${dppYear}-${String(month1Indexed).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: pregnancies } = await supabase
      .from("pregnancies")
      .select("patient_id, due_date, dum, has_finished, born_at, observations")
      .in("patient_id", patientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate);

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
    const filteredIds = (pregnancies ?? []).map((p) => p.patient_id);

    if (filteredIds.length === 0) {
      return { patients: [], totalCount: 0, teamMembersMap: {} };
    }

    let patientsQuery = supabase.from("patients").select("*").in("id", filteredIds);
    if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);
    const { data: patientsData } = await patientsQuery;

    rows = (patientsData ?? []).map((p) => ({
      ...p,
      due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
      dum: pregnancyByPatient.get(p.id)?.dum ?? null,
      has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
      born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
      observations: pregnancyByPatient.get(p.id)?.observations ?? null,
    }));
    totalCount = rows.length;
  } else {
    // Standard RPC path
    const offset = (page - 1) * PATIENTS_PER_PAGE;

    const { data } = await supabase.rpc("get_filtered_patients", {
      patient_ids: patientIds,
      filter_type: filter,
      search_query: search,
      page_limit: PATIENTS_PER_PAGE,
      page_offset: offset,
    });

    const rpcRows = (data as (PatientWithPregnancyFields & { total_count: number })[]) ?? [];
    totalCount = rpcRows.length > 0 ? Number(rpcRows[0]?.total_count) : 0;
    rows = rpcRows;
  }

  const pagePatientIds = rows.map((r) => r.id);
  const teamMembersMap: Record<string, TeamMember[]> = {};

  if (pagePatientIds.length > 0) {
    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select("id, patient_id, professional_id, professional_type, joined_at, professional:users(id, name, email, avatar_url)")
      .in("patient_id", pagePatientIds);

    for (const tm of teamMembersData ?? []) {
      const pid = (tm as typeof tm & { patient_id: string }).patient_id;
      if (!teamMembersMap[pid]) teamMembersMap[pid] = [];
      teamMembersMap[pid].push(tm as unknown as TeamMember);
    }
  }

  return { patients: rows, totalCount, teamMembersMap };
}
