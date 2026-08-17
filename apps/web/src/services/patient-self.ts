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

  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

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

export type Contract = Tables<"contracts">;

// contract.is_signed already tracks the professional's signature regardless of
// signing order — but the patient's own status has no such flag on `contracts`
// (either party can sign first), so it's derived from contract_signatures here.
export type ContractListItem = Contract & { patientSigned: boolean };

export async function getMyContracts(): Promise<{
  contracts: ContractListItem[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { contracts: [], error };
  }

  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("patient_id", patientId)
    .eq("is_base_contract", false)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const contracts = data ?? [];
  if (contracts.length === 0) return { contracts: [] };

  const { data: patientSignatures } = await supabase
    .from("contract_signatures")
    .select("contract_id")
    .eq("signer_role", "patient")
    .in(
      "contract_id",
      contracts.map((c) => c.id),
    );

  const patientSignedContractIds = new Set((patientSignatures ?? []).map((s) => s.contract_id));

  return {
    contracts: contracts.map((contract) => ({
      ...contract,
      patientSigned: patientSignedContractIds.has(contract.id),
    })),
  };
}

export async function getMyContractById(contractId: string): Promise<{
  contract: ContractListItem | null;
  changeRequests: Tables<"contract_change_requests">[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { contract: null, changeRequests: [], error };
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("patient_id", patientId)
    .eq("is_base_contract", false)
    .eq("is_active", true)
    .maybeSingle();

  if (!contract) {
    return { contract: null, changeRequests: [], error: "Contrato não encontrado" };
  }

  const { data: changeRequests } = await supabase
    .from("contract_change_requests")
    .select("*")
    .eq("contract_id", contractId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: patientSignature } = await supabase
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", contractId)
    .eq("signer_role", "patient")
    .maybeSingle();

  return {
    contract: { ...contract, patientSigned: !!patientSignature },
    changeRequests: changeRequests ?? [],
  };
}

export type ContractChangeRequestWithContract = Tables<"contract_change_requests"> & {
  contract: Pick<Contract, "id" | "title"> | null;
};

export async function getMyContractChangeRequests(): Promise<{
  changeRequests: ContractChangeRequestWithContract[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { changeRequests: [], error };
  }

  const { data } = await supabase
    .from("contract_change_requests")
    .select("*, contract:contracts(id, title)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return { changeRequests: (data as ContractChangeRequestWithContract[]) ?? [] };
}
