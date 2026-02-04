import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Appointment = Tables<"appointments">;
type Patient = Tables<"patients">;

export type AppointmentWithPatient = Appointment & {
  patient: Pick<Patient, "id" | "name">;
};

type GetMyAppointmentsResult = {
  appointments: AppointmentWithPatient[];
  error?: string;
};

export async function getMyAppointments(): Promise<GetMyAppointmentsResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { appointments: [], error: "Usuário não encontrado" };
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patient:patients!appointments_patient_id_fkey(id, name)
    `,
    )
    .eq("professional_id", user.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  return { appointments: (appointments as AppointmentWithPatient[]) || [] };
}
