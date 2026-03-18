"use server";

import { dayjs } from "@/lib/dayjs";
import { getDppDateRange } from "@/lib/dpp-filter";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { authActionClient } from "@/lib/safe-action";
import type { PatientFilter, PatientWithGestationalInfo, TeamMember } from "@/types";
import { z } from "zod";

const schema = z.object({
  filter: z.enum(["all", "recent", "trim1", "trim2", "trim3", "final"]).default("all"),
  search: z.string().default(""),
  professionalId: z.string().optional(),
  dppMonth: z.number().optional(),
  dppYear: z.number().optional(),
});

export const getEnterpriseHomePatientsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, profile } }) => {
    const { filter, search, professionalId, dppMonth, dppYear } = parsedInput;

    if (!profile.enterprise_id) {
      return { items: [] as { patient: PatientWithGestationalInfo; teamMembers: TeamMember[] }[] };
    }

    // Busca pacientes do profissional específico ou de todos da organização
    let teamMembersQuery = supabase.from("team_members").select("patient_id");

    if (professionalId) {
      teamMembersQuery = teamMembersQuery.eq("professional_id", professionalId);
    } else {
      const { data: professionals } = await supabase
        .from("users")
        .select("id")
        .eq("enterprise_id", profile.enterprise_id)
        .eq("user_type", "professional");

      const professionalIds = professionals?.map((p) => p.id) ?? [];
      if (professionalIds.length === 0) {
        return { patients: [] as PatientWithGestationalInfo[] };
      }
      teamMembersQuery = teamMembersQuery.in("professional_id", professionalIds);
    }

    const { data: patientIdRows } = await teamMembersQuery;

    const allPatientIds = [...new Set(patientIdRows?.map((tm) => tm.patient_id) ?? [])];

    if (allPatientIds.length === 0) {
      return { items: [] as { patient: PatientWithGestationalInfo; teamMembers: TeamMember[] }[] };
    }

    type RawPatient = {
      id: string;
      name: string;
      phone: string;
      email: string | null;
      street: string | null;
      neighborhood: string | null;
      complement: string | null;
      number: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      date_of_birth: string | null;
      created_at: string | null;
      updated_at: string | null;
      created_by: string;
      user_id: string | null;
      due_date?: string | null;
      dum?: string | null;
      has_finished?: boolean;
      born_at?: string | null;
      observations?: string | null;
    };

    const today = dayjs();
    let rawPatients: RawPatient[] = [];

    if (dppMonth !== undefined && dppYear !== undefined) {
      const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

      // Filter via pregnancies: get pregnancies in date range, then fetch patients
      const pregnancyQuery = supabase
        .from("pregnancies")
        .select("patient_id, due_date, dum, has_finished, born_at, observations")
        .in("patient_id", allPatientIds)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });

      const { data: pregnancies, error: pregError } = await pregnancyQuery;
      if (pregError) throw new Error(pregError.message);

      const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
      const filteredByDppIds = (pregnancies ?? []).map((p) => p.patient_id);

      if (filteredByDppIds.length === 0) {
        rawPatients = [];
      } else {
        let patientsQuery = supabase.from("patients").select("*").in("id", filteredByDppIds);

        if (search) patientsQuery = patientsQuery.ilike("name", `%${search}%`);
        const { data, error } = await patientsQuery;
        if (error) throw new Error(error.message);

        rawPatients = (data ?? []).map((p) => ({
          ...p,
          due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
          dum: pregnancyByPatient.get(p.id)?.dum ?? null,
          has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
          born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
          observations: pregnancyByPatient.get(p.id)?.observations ?? null,
        }));
      }
    } else {
      const { data, error } = await supabase.rpc("get_filtered_patients", {
        patient_ids: allPatientIds,
        filter_type: filter as PatientFilter,
        search_query: search,
      });
      if (error) throw new Error(error.message);
      rawPatients = (data ?? []) as unknown as RawPatient[];
    }

    const filteredPatientIds = rawPatients.map((p) => p.id);

    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select(
        "patient_id, id, professional_id, professional_type, joined_at, professional:users!team_members_professional_id_fkey(id, name, email, avatar_url)",
      )
      .in("patient_id", filteredPatientIds);

    const teamMembersByPatient = new Map<string, TeamMember[]>();
    for (const tm of teamMembersData ?? []) {
      const list = teamMembersByPatient.get(tm.patient_id) ?? [];
      list.push(tm as unknown as TeamMember);
      teamMembersByPatient.set(tm.patient_id, list);
    }

    const items = rawPatients.slice(0, 20).map((patient) => {
      const gestationalAge = calculateGestationalAge(patient.dum ?? null);
      const dueDate = dayjs(patient.due_date);
      const remainingDays = dueDate.diff(today, "day");

      const patientWithInfo: PatientWithGestationalInfo = {
        ...patient,
        due_date: patient.due_date ?? null,
        dum: patient.dum ?? null,
        has_finished: patient.has_finished ?? false,
        born_at: patient.born_at ?? null,
        observations: patient.observations ?? null,
        weeks: gestationalAge?.weeks ?? 0,
        days: gestationalAge?.days ?? 0,
        remainingDays: Math.max(remainingDays, 0),
        progress: gestationalAge ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100) : 0,
      };

      return {
        patient: patientWithInfo,
        teamMembers: teamMembersByPatient.get(patient.id) ?? [],
      };
    });

    return { items };
  });
