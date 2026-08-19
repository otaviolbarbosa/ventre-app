import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { buildDppByMonth, type HomeAppointment, type HomeData } from "@/services/home";
import type { PatientWithGestationalInfo } from "@/types";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

async function fetchHomeData(userId: string): Promise<HomeData> {
  const supabase = await createServerSupabaseAdmin();
  const today = dayjs();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", userId);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

  if (patientIds.length === 0) {
    return {
      dppByMonth: buildDppByMonth([], today),
      patients: [],
      upcomingAppointments: [],
    };
  }

  const { data: patients } = await supabase
    .from("patients")
    .select(
      "*, pregnancies!inner(due_date, dum, has_finished, born_at, delivery_method, observations)",
    )
    .in("id", patientIds)
    .eq("pregnancies.has_finished", false)
    .order("due_date", { referencedTable: "pregnancies", ascending: true });

  const sortedPatients = patients || [];

  const patientsWithInfo: PatientWithGestationalInfo[] = [];

  for (const patient of sortedPatients) {
    const pregnancy = patient.pregnancies?.[0];
    const gestationalAge = calculateGestationalAge(pregnancy?.dum ?? null);
    if (gestationalAge) {
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

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patient:patients(id, name, pregnancies(dum))
    `,
    )
    .eq("professional_id", userId)
    .gte("date", today.format("YYYY-MM-DD"))
    .eq("status", "agendada")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(5);

  const patientsForDpp = (patients || []).map((p) => ({
    due_date: p.pregnancies?.[0]?.due_date ?? null,
  }));

  return {
    dppByMonth: buildDppByMonth(patientsForDpp, today),
    patients: patientsWithInfo.slice(0, 5),
    upcomingAppointments: (appointments as HomeAppointment[]) || [],
  };
}

export function getCachedHomeData(userId: string): Promise<HomeData> {
  return fetchHomeData(userId);
}
