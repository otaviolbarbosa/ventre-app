import type { Tables } from "@ventre/supabase/types";

type UserProfile = Tables<"users"> | null | undefined;

export function isManager(profile: UserProfile): boolean {
  return profile?.user_type === "manager";
}

export function isSecretary(profile: UserProfile): boolean {
  return profile?.user_type === "secretary";
}

export function isProfessional(profile: UserProfile): boolean {
  return profile?.user_type === "professional";
}

export function isPatient(profile: UserProfile): boolean {
  return profile?.user_type === "patient";
}

/** Returns true for managers and secretaries (enterprise staff). */
export function isStaff(profile?: UserProfile): boolean {
  if (!profile) return false;
  return isManager(profile) || isSecretary(profile);
}
