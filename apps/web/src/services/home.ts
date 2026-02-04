import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Patient = Tables<"patients">;
type Appointment = Tables<"appointments">;

export type PatientWithGestationalInfo = Patient & {
  weeks: number;
  remainingDays: number;
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
  upcomingDueDates: PatientWithGestationalInfo[];
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
      upcomingDueDates: [],
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
      upcomingDueDates: [],
      upcomingAppointments: [],
    };
  }

  // Get all patients
  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds);

  // Calculate trimester counts and prepare upcoming due dates
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

      // Calculate remaining days until due date
      const dueDate = dayjs(patient.due_date);
      const remainingDays = dueDate.diff(today, "day");

      // Only include patients with upcoming due dates (within next 60 days)
      if (remainingDays >= 0 && remainingDays <= 60) {
        patientsWithInfo.push({
          ...patient,
          weeks: gestationalAge.weeks,
          remainingDays,
        });
      }
    }
  }

  // Sort by due date (closest first) and take top 3
  const upcomingDueDates = patientsWithInfo
    .sort((a, b) => a.remainingDays - b.remainingDays)
    .slice(0, 3);

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
    .limit(3);

  return {
    trimesterCounts,
    upcomingDueDates,
    upcomingAppointments: (appointments as HomeAppointment[]) || [],
  };
}
