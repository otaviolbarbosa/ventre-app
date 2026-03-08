import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientWithGestationalInfo } from "@/types";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Patient = Tables<"patients">;
type Appointment = Tables<"appointments">;
type User = Tables<"users">;

export type EnterpriseAppointment = Appointment & {
  patient: Pick<Patient, "id" | "name" | "dum">;
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
  patients: PatientWithGestationalInfo[];
  upcomingAppointments: EnterpriseAppointment[];
  professionals: EnterpriseProfessional[];
  allPatientIds: string[];
};

const EMPTY: HomeEnterpriseData = {
  trimesterCounts: { first: 0, second: 0, third: 0 },
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
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = await createServerSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY;

  // Busca o enterprise_id do usuário atual
  const { data: currentUser } = await supabase
    .from("users")
    .select("enterprise_id")
    .eq("id", user.id)
    .single();

  if (!currentUser?.enterprise_id) return EMPTY;

  const enterpriseId = currentUser.enterprise_id;

  // Busca todos os profissionais da organização
  const { data: professionals } = await supabaseAdmin
    .from("users")
    .select("id, name, professional_type")
    .eq("enterprise_id", enterpriseId)
    .eq("user_type", "professional");

  if (!professionals || professionals.length === 0) {
    return { ...EMPTY };
  }

  const professionalIds = professionals.map((p) => p.id);

  // Busca todos os pacientes dos profissionais da organização via team_members
  const { data: teamMembers } = await supabaseAdmin
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
  }));

  if (allPatientIds.length === 0) {
    return {
      ...EMPTY,
      professionals: professionalsWithCount,
    };
  }

  // Busca pacientes
  const { data: patients } = await supabaseAdmin
    .from("patients")
    .select("*")
    .in("id", allPatientIds)
    .is("finished_at", null)
    .order("due_date", { ascending: true });

  const trimesterCounts: TrimesterCounts = { first: 0, second: 0, third: 0 };
  const today = dayjs();
  const patientsWithInfo: PatientWithGestationalInfo[] = [];

  for (const patient of patients ?? []) {
    const gestationalAge = calculateGestationalAge(patient.dum);
    if (gestationalAge) {
      const trimester = getTrimester(gestationalAge.weeks);
      if (trimester === 1) trimesterCounts.first++;
      else if (trimester === 2) trimesterCounts.second++;
      else if (trimester === 3) trimesterCounts.third++;

      const dueDate = dayjs(patient.due_date);
      const remainingDays = Math.max(dueDate.diff(today, "day"), 0);

      patientsWithInfo.push({
        ...patient,
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
      patient:patients!appointments_patient_id_fkey(id, name, dum),
      professional:users!appointments_professional_id_fkey(id, name)
    `,
    )
    .in("professional_id", professionalIds)
    .gte("date", today.format("YYYY-MM-DD"))
    .eq("status", "agendada")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(10);

  return {
    trimesterCounts,
    patients: patientsWithInfo.slice(0, 5),
    upcomingAppointments: (appointments as EnterpriseAppointment[]) ?? [],
    professionals: professionalsWithCount,
    allPatientIds,
  };
}
