import type { Tables } from "@ventre/supabase/types";

type UserProfile = (Tables<"users"> & { enterprise_id?: string | null }) | null | undefined;

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

export function isAdmin(profile: UserProfile): boolean {
  return profile?.user_type === "admin";
}

/**
 * Whether this profile needs an active subscription to access the app.
 * Patients and admins never do. Professionals/staff only once they've
 * finished onboarding — mirrors the onboarding-complete rule in proxy.ts,
 * since a professional_type/enterprise isn't assigned yet at that point
 * and there's no way they could have subscribed either.
 */
export function mustHaveActiveSubscription(profile: UserProfile): boolean {
  if (!profile) return false;
  if (isPatient(profile) || isAdmin(profile)) return false;
  if (isProfessional(profile)) return profile.professional_type != null;
  if (isStaff(profile)) return (profile.enterprise_id ?? null) != null;
  return false;
}
