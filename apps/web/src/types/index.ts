import type { Tables } from "@nascere/supabase";

export type ProfessionalType = "obstetra" | "enfermeiro" | "doula";
export type Invite = {
  id: string;
  professional_type: ProfessionalType | null;
  expires_at: string;
  patient: { id: string; name: string; due_date: string; dum: string } | null;
  inviter: { name: string; professional_type: string | null } | null;
};

export type TeamMember = {
  id: string;
  professional_id: string;
  professional_type: ProfessionalType;
  joined_at: string | null;
  professional: { id: string; name: string; email: string } | null;
};

export type Professional = {
  id: string;
  name: string;
  email: string;
  professional_type: ProfessionalType | null;
};

export type PatientWithGestationalInfo = Tables<"patients"> & {
  weeks: number;
  days: number;
  remainingDays: number;
  progress: number;
};

export type PatientFilter = "all" | "recent" | "trim1" | "trim2" | "trim3" | "final";
