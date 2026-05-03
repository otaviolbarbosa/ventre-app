import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import type { CreateAppointmentInput } from "@/lib/validations/appointment";
import type { createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables, TablesInsert } from "@ventre/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type Appointment = Tables<"appointments">;
type Patient = Tables<"patients">;
type User = Tables<"users">;

export type AppointmentWithPatient = Appointment & {
  patient: Pick<Patient, "id" | "name">;
  professional?: Pick<User, "id" | "name" | "professional_type"> | null;
};

type GetMyAppointmentsResult = {
  appointments: AppointmentWithPatient[];
  error?: string;
};

export async function getMyAppointments(): Promise<GetMyAppointmentsResult> {
  const { supabase, user, profile } = await getServerAuth();

  if (!user) {
    return { appointments: [], error: "Usuário não encontrado" };
  }

  let query = supabase
    .from("appointments")
    .select(
      `
      *,
      patient:patients!appointments_patient_id_fkey(id, name),
      professional:users!appointments_professional_id_fkey(id, name, professional_type)
    `,
    )
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (!isStaff(profile)) {
    query = query.eq("professional_id", user.id);
  }

  const { data: appointments } = await query;

  return { appointments: (appointments as AppointmentWithPatient[]) || [] };
}

export async function createAppointment(
  supabase: SupabaseClient,
  userId: string,
  data: CreateAppointmentInput,
) {
  const insertData: TablesInsert<"appointments"> = {
    patient_id: data.patient_id,
    professional_id: userId,
    date: data.date,
    time: data.time,
    duration: data.duration,
    type: data.type,
    location: data.location,
    notes: data.notes,
  };

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return appointment;
}
