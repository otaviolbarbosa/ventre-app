import { getServerAuth } from "@/lib/server-auth";
import type { Tables } from "@ventre/supabase/types";

type Pregnancy = Tables<"pregnancies">;
type Patient = Tables<"patients">;
type Appointment = Tables<"appointments">;
type Billing = Tables<"billings">;
type Installment = Tables<"installments">;

export type MyPatient = Patient & { address: Record<string, string | null> | null };

async function getMyPatientId(): Promise<{ patientId: string | null; error?: string }> {
  const { supabase, user } = await getServerAuth();

  if (!user) {
    return { patientId: null, error: "Usuário não encontrado" };
  }

  const { data } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();

  if (!data) {
    return { patientId: null, error: "Nenhuma ficha de paciente vinculada a esta conta" };
  }

  return { patientId: data.id };
}

export async function getMyPregnancy(): Promise<{
  patient: MyPatient | null;
  pregnancy: Pregnancy | null;
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { patient: null, pregnancy: null, error };
  }

  const { data: patientData } = await supabase
    .from("patients")
    .select("*, addresses(street, number, complement, neighborhood, city, state, zipcode)")
    .eq("id", patientId)
    .single();

  const { data: pregnancy } = await supabase
    .from("pregnancies")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!patientData) {
    return { patient: null, pregnancy: pregnancy ?? null, error: "Paciente não encontrada" };
  }

  const { addresses: addrs, ...patient } = patientData as typeof patientData & {
    addresses: unknown[];
  };
  const address =
    Array.isArray(addrs) && addrs.length > 0 ? (addrs[0] as Record<string, string | null>) : null;

  return { patient: { ...patient, address }, pregnancy: pregnancy ?? null };
}

export type AppointmentWithProfessional = Appointment & {
  professional: Pick<Tables<"users">, "id" | "name" | "professional_type"> | null;
};

export async function getMyPatientAppointments(): Promise<{
  appointments: AppointmentWithProfessional[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { appointments: [], error };
  }

  const { data } = await supabase
    .from("appointments")
    .select("*, professional:users!appointments_professional_id_fkey(id, name, professional_type)")
    .eq("patient_id", patientId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  return { appointments: (data as AppointmentWithProfessional[]) ?? [] };
}

export type BillingWithInstallments = Billing & { installments: Installment[] };

export async function getMyBillingSummary(): Promise<{
  billings: BillingWithInstallments[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { billings: [], error };
  }

  const { data } = await supabase
    .from("billings")
    .select("*, installments(*)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return { billings: (data as BillingWithInstallments[]) ?? [] };
}
