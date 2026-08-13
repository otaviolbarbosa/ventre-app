import { isStaff } from "@/lib/access-control";
import { buildPatientWithGestationalInfo } from "@/lib/gestational-age";
import { getServerAuth } from "@/lib/server-auth";
import type { CreateAppointmentInput } from "@/lib/validations/appointment";
import type { PatientWithGestationalInfo } from "@/types";
import type {
  createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@ventre/supabase/server";
import type { Tables, TablesInsert } from "@ventre/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type Appointment = Tables<"appointments">;
type Patient = Tables<"patients">;
type User = Tables<"users">;
type Pregnancy = Tables<"pregnancies">;

export type AppointmentWithPatient = Appointment & {
  patient: PatientWithGestationalInfo | null;
  professional?: Pick<User, "id" | "name" | "professional_type"> | null;
};

export const APPOINTMENT_WITH_PATIENT_SELECT = `
  *,
  patient:patients(*, pregnancies(due_date, dum, has_finished, born_at, delivery_method, observations)),
  professional:users!appointments_professional_id_fkey(id, name, professional_type)
`;

type PregnancyInfo = Pick<
  Pregnancy,
  "due_date" | "dum" | "has_finished" | "born_at" | "delivery_method" | "observations"
>;

type RawAppointment = Appointment & {
  patient: (Patient & { pregnancies: PregnancyInfo[] | null }) | null;
  professional?: Pick<User, "id" | "name" | "professional_type"> | null;
};

export function mapAppointmentsWithPatient(rows: RawAppointment[]): AppointmentWithPatient[] {
  return rows.map(({ patient, ...appointment }) => {
    if (!patient) return { ...appointment, patient: null };

    const { pregnancies, ...patientData } = patient;
    const activePregnancy =
      pregnancies?.find((pregnancy) => !pregnancy.has_finished) ?? pregnancies?.[0] ?? null;

    return {
      ...appointment,
      patient: buildPatientWithGestationalInfo(patientData, activePregnancy),
    };
  });
}

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
    .select(APPOINTMENT_WITH_PATIENT_SELECT)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (!isStaff(profile)) {
    query = query.eq("professional_id", user.id);
  }

  const { data: appointments } = await query.eq("status", "agendada");

  return {
    appointments: mapAppointmentsWithPatient((appointments ?? []) as unknown as RawAppointment[]),
  };
}

export async function createAppointment(
  supabase: SupabaseClient | SupabaseAdminClient,
  userId: string,
  data: CreateAppointmentInput,
  enterpriseId?: string | null,
) {
  const insertData: TablesInsert<"appointments"> = {
    patient_id: data.is_external ? null : data.patient_id,
    professional_id: userId,
    date: data.date,
    time: data.time,
    duration: data.duration,
    type: data.type,
    location: data.location,
    notes: data.notes,
    external_patient_name: data.is_external ? (data.external_patient_name ?? null) : null,
    external_patient_phone: data.is_external ? (data.external_patient_phone ?? null) : null,
    external_patient_email: data.is_external ? data.external_patient_email || null : null,
    ...(enterpriseId ? { enterprise_id: enterpriseId } : {}),
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
