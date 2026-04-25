import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { getServerAuth } from "@/lib/server-auth";
import { type DppByMonth, buildDppByMonth } from "@/services/home";
import type { PatientWithGestationalInfo } from "@/types";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

type Patient = Tables<"patients">;
type Pregnancy = Tables<"pregnancies">;
type Appointment = Tables<"appointments">;
type User = Tables<"users">;

type PatientForHome = Pick<Patient, "id" | "name"> & {
  pregnancies: Pick<Pregnancy, "dum">[];
};

export type EnterpriseAppointment = Appointment & {
  patient: PatientForHome;
  professional: Pick<User, "id" | "name">;
};

export type EnterpriseProfessional = {
  id: string;
  name: string | null;
  professional_type: string | null;
  patient_count: number;
};

export type TrimesterCounts = {
  first: number;
  second: number;
  third: number;
};

export type HomeEnterpriseData = {
  trimesterCounts: TrimesterCounts;
  dppByMonth: DppByMonth[];
  patients: PatientWithGestationalInfo[];
  upcomingAppointments: EnterpriseAppointment[];
  professionals: EnterpriseProfessional[];
  allPatientIds: string[];
};

const EMPTY: HomeEnterpriseData = {
  trimesterCounts: { first: 0, second: 0, third: 0 },
  dppByMonth: [],
  patients: [],
  upcomingAppointments: [],
  professionals: [],
  allPatientIds: [],
};

function getTrimester(weeks: number): 1 | 2 | 3 | null {
  if (weeks < 0 || weeks > 42) return null;
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

export async function getHomeEnterpriseData(): Promise<HomeEnterpriseData> {
  const { supabase, profile } = await getServerAuth();
  const supabaseAdmin = await createServerSupabaseAdmin();

  if (!profile?.enterprise_id) return EMPTY;

  const enterpriseId = profile.enterprise_id;

  // Busca todos os profissionais da organização
  const { data: professionals } = await supabase
    .from("users")
    .select("id, name, professional_type, avatar_url")
    .eq("enterprise_id", enterpriseId)
    .eq("user_type", "professional");

  if (!professionals || professionals.length === 0) {
    return { ...EMPTY };
  }

  const professionalIds = professionals.map((p) => p.id);

  // Busca todos os pacientes dos profissionais da organização via team_members
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id, professional_id")
    .in("professional_id", professionalIds);

  const allPatientIds = [...new Set(teamMembers?.map((tm) => tm.patient_id) ?? [])];

  // Monta mapa de pacientes por profissional para contagem
  const patientCountByProfessional: Record<string, Set<string>> = {};
  for (const tm of teamMembers ?? []) {
    if (!patientCountByProfessional[tm.professional_id]) {
      patientCountByProfessional[tm.professional_id] = new Set();
    }
    patientCountByProfessional[tm.professional_id]?.add(tm.patient_id);
  }

  const professionalsWithCount: EnterpriseProfessional[] = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    professional_type: p.professional_type,
    patient_count: patientCountByProfessional[p.id]?.size ?? 0,
    avatar_url: p.avatar_url,
  }));

  if (allPatientIds.length === 0) {
    return {
      ...EMPTY,
      professionals: professionalsWithCount,
    };
  }

  // Busca pacientes com gestação ativa
  const { data: patients } = await supabaseAdmin
    .from("patients")
    .select("*, pregnancies(due_date, dum, has_finished, born_at, delivery_method, observations)")
    .in("id", allPatientIds);

  const trimesterCounts: TrimesterCounts = { first: 0, second: 0, third: 0 };
  const today = dayjs();
  const patientsWithInfo: PatientWithGestationalInfo[] = [];

  // Sort by due_date from pregnancy
  const sortedPatients = (patients ?? []).slice().sort((a, b) => {
    const aDate = a.pregnancies?.[0]?.due_date ?? "";
    const bDate = b.pregnancies?.[0]?.due_date ?? "";
    return aDate.localeCompare(bDate);
  });

  for (const patient of sortedPatients) {
    const pregnancy = patient.pregnancies?.[0];
    const gestationalAge = calculateGestationalAge(pregnancy?.dum ?? null);
    if (gestationalAge) {
      const trimester = getTrimester(gestationalAge.weeks);
      if (trimester === 1) trimesterCounts.first++;
      else if (trimester === 2) trimesterCounts.second++;
      else if (trimester === 3) trimesterCounts.third++;

      const dueDate = dayjs(pregnancy?.due_date);
      const remainingDays = Math.max(dueDate.diff(today, "day"), 0);

      patientsWithInfo.push({
        ...patient,
        due_date: pregnancy?.due_date ?? null,
        dum: pregnancy?.dum ?? null,
        has_finished: pregnancy?.has_finished ?? false,
        born_at: pregnancy?.born_at ?? null,
        delivery_method: pregnancy?.delivery_method ?? null,
        observations: pregnancy?.observations ?? null,
        weeks: gestationalAge.weeks,
        days: gestationalAge.days,
        remainingDays,
        progress: Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100),
      });
    }
  }

  // Busca próximas consultas de todos os profissionais da organização
  const { data: appointments } = await supabaseAdmin
    .from("appointments")
    .select(
      `
      *,
      patient:patients!appointments_patient_id_fkey(id, name, pregnancies(dum)),
      professional:users!appointments_professional_id_fkey(id, name)
    `,
    )
    .in("professional_id", professionalIds)
    .gte("date", today.format("YYYY-MM-DD"))
    .eq("status", "agendada")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(10);

  const patientsForDpp = (patients ?? []).map((p) => ({
    due_date: p.pregnancies?.[0]?.due_date ?? null,
  }));

  return {
    trimesterCounts,
    dppByMonth: buildDppByMonth(patientsForDpp, today),
    patients: patientsWithInfo.slice(0, 5),
    upcomingAppointments: (appointments as EnterpriseAppointment[]) ?? [],
    professionals: professionalsWithCount,
    allPatientIds,
  };
}
