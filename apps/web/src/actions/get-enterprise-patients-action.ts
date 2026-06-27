"use server";

import { PATIENTS_PER_PAGE } from "@/lib/constants";
import { getDppDateRange } from "@/lib/dpp-filter";
import type { PatientWithPregnancyFields } from "@/services/patient";
import type { PatientFilter, TeamMember } from "@/types";
import { createServerSupabaseClient } from "@ventre/supabase/server";

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

  let pregnanciesQuery = supabase
    .from("pregnancies")
    .select("due_date, patient_id")
    .eq("enterprise_id", enterpriseId);

  if (professionalId) {
    const { data: teamMemberships } = await supabase
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", professionalId);
    const professionalPatientIds = teamMemberships?.map((tm) => tm.patient_id) ?? [];
    if (professionalPatientIds.length === 0) return [];
    pregnanciesQuery = pregnanciesQuery.in("patient_id", professionalPatientIds);
  }

  const { data } = await pregnanciesQuery;
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

  const { data: enterprisePregnancies } = await supabase
    .from("pregnancies")
    .select("patient_id")
    .eq("enterprise_id", enterpriseId);

  let patientIds = [...new Set((enterprisePregnancies ?? []).map((p) => p.patient_id))];

  if (patientIds.length === 0) {
    return { patients: [], totalCount: 0, teamMembersMap: {} };
  }

  if (professionalId) {
    const { data: teamMemberships } = await supabase
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", professionalId)
      .in("patient_id", patientIds);
    const professionalPatientIds = new Set(teamMemberships?.map((tm) => tm.patient_id) ?? []);
    patientIds = patientIds.filter((id) => professionalPatientIds.has(id));

    if (patientIds.length === 0) {
      return { patients: [], totalCount: 0, teamMembersMap: {} };
    }
  }

  let rows: PatientWithPregnancyFields[] = [];
  let totalCount = 0;

  if (dppMonth !== undefined && dppYear !== undefined) {
    // DPP filter path: query pregnancies directly
    const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

    const { data: pregnancies } = await supabase
      .from("pregnancies")
      .select("patient_id, due_date, dum, has_finished, born_at, observations")
      .in("patient_id", patientIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
    const filteredIds = (pregnancies ?? []).map((p) => p.patient_id);

    if (filteredIds.length === 0) {
      return { patients: [], totalCount: 0, teamMembersMap: {} };
    }

    let patientsQuery = supabase
      .from("patients")
      .select("*, addresses(street, number, complement, neighborhood, city, state, zipcode)")
      .in("id", filteredIds);
    if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);
    const { data: patientsData } = await patientsQuery;

    rows = (patientsData ?? [])
      .map((p) => {
        const { addresses: addrs, ...patientData } = p as typeof p & { addresses: unknown[] };
        const address = Array.isArray(addrs) && addrs.length > 0 ? (addrs[0] as Record<string, string | null>) : null;
        return {
          ...patientData,
          address,
          due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
          dum: pregnancyByPatient.get(p.id)?.dum ?? null,
          has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
          born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
          observations: pregnancyByPatient.get(p.id)?.observations ?? null,
        };
      })
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
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

    const rpcRows =
      (data as unknown as (PatientWithPregnancyFields & { total_count: number })[]) ?? [];
    totalCount = rpcRows.length > 0 ? Number(rpcRows[0]?.total_count) : 0;
    rows = rpcRows;
  }

  const pagePatientIds = rows.map((r) => r.id);
  const teamMembersMap: Record<string, TeamMember[]> = {};

  if (pagePatientIds.length > 0) {
    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select(
        "id, patient_id, professional_id, professional_type, joined_at, is_backup, professional:users(id, name, email, avatar_url)",
      )
      .in("patient_id", pagePatientIds);

    for (const tm of teamMembersData ?? []) {
      const pid = (tm as typeof tm & { patient_id: string }).patient_id;
      if (!teamMembersMap[pid]) teamMembersMap[pid] = [];
      teamMembersMap[pid].push(tm as unknown as TeamMember);
    }
  }

  return { patients: rows, totalCount, teamMembersMap };
}
