import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Patient = Tables<"patients">;
type Appointment = Tables<"appointments">;

export type PatientWithGestationalInfo = Patient & {
  weeks: number;
  days: number;
  remainingDays: number;
  progress: number;
};

export type HomeAppointment = Appointment & {
  patient: Pick<Patient, "id" | "name" | "dum">;
};

export type TrimesterCounts = {
  first: number;
  second: number;
  third: number;
};

export type HomeData = {
  trimesterCounts: TrimesterCounts;
  patients: PatientWithGestationalInfo[];
  upcomingAppointments: HomeAppointment[];
};

function getTrimester(weeks: number): 1 | 2 | 3 | null {
  if (weeks < 0 || weeks > 42) return null;
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      trimesterCounts: { first: 0, second: 0, third: 0 },
      patients: [],
      upcomingAppointments: [],
    };
  }

  // Get patients where user is a team member
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", user.id);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

  if (patientIds.length === 0) {
    return {
      trimesterCounts: { first: 0, second: 0, third: 0 },
      patients: [],
      upcomingAppointments: [],
    };
  }

  // Get all patients
  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds)
    .order("due_date", { ascending: true });

  // Calculate trimester counts and prepare patient list
  const trimesterCounts: TrimesterCounts = { first: 0, second: 0, third: 0 };
  const today = dayjs();

  const patientsWithInfo: PatientWithGestationalInfo[] = [];

  for (const patient of patients || []) {
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

  // Get upcoming appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patient:patients!appointments_patient_id_fkey(id, name, dum)
    `,
    )
    .eq("professional_id", user.id)
    .gte("date", today.format("YYYY-MM-DD"))
    .eq("status", "agendada")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(5);

  return {
    trimesterCounts,
    patients: patientsWithInfo.slice(0, 5),
    upcomingAppointments: (appointments as HomeAppointment[]) || [],
  };
}
