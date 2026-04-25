import type { Enums, Tables } from "@ventre/supabase";

export type ProfessionalType = "obstetra" | "enfermeiro" | "doula";

export type Patient = Tables<"patients">;

export type Invite = {
  id: string;
  professional_type: ProfessionalType | null;
  expires_at: string;
  patient: {
    id: string;
    name: string;
    pregnancies: { due_date: string; dum: string | null }[];
  } | null;
  inviter: { id: string; name: string; professional_type: string | null } | null;
};

export type TeamMember = {
  id: string;
  professional_id: string;
  professional_type: ProfessionalType;
  joined_at: string | null;
  is_backup: boolean | null;
  professional: { id: string; name: string; email: string; avatar_url: string } | null;
};

export type Professional = {
  id: string;
  name: string;
  email: string;
  professional_type: ProfessionalType | null;
};

export type PatientWithGestationalInfo = Tables<"patients"> & {
  due_date: string | null;
  dum: string | null;
  has_finished: boolean;
  born_at: string | null;
  delivery_method: Enums<"delivery_method"> | null;
  observations: string | null;
  weeks: number;
  days: number;
  remainingDays: number;
  progress: number;
};

export type PatientFilter = "all" | "recent" | "trim1" | "trim2" | "trim3" | "final" | "finished";
