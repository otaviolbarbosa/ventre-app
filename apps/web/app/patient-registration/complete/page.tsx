import PatientRegisterCompleteScreen from "@/screens/patient-register-complete-screen";
import RegistrationCompleteNotice from "@/screens/registration-complete-notice-screen";
import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ piid?: string }> };

export default async function PatientRegistrationCompletePage({ searchParams }: PageProps) {
  const { piid } = await searchParams;
  const { user, profile } = await getServerAuth();

  if (!piid) {
    redirect(user ? "/home" : "/login");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite } = await supabaseAdmin
    .from("patient_invite_links")
    .select("id, invite_type, name, email, phone, patient_id, expires_at, used_at")
    .eq("id", piid)
    .maybeSingle();

  if (!invite || new Date(invite.expires_at) < new Date()) {
    redirect(user ? "/home" : "/login");
  }

  // Password-based self-registration already finished and marked the invite as used.
  // If there is no session yet, the account is pending e-mail confirmation — show a
  // notice instead of bouncing to /login (which has no context for this state).
  if (invite.used_at) {
    if (user && profile?.user_type === "patient") {
      redirect("/home");
    }
    return <RegistrationCompleteNotice email={invite.email} />;
  }

  if (!user) {
    redirect("/login");
  }

  if (profile?.user_type !== "patient") {
    redirect("/home");
  }

  let linkedPatient: { id: string; name: string; email: string | null; phone: string } | null =
    null;

  if (invite.invite_type === "link_existing" && invite.patient_id) {
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, name, email, phone")
      .eq("id", invite.patient_id)
      .maybeSingle();

    if (patient) {
      linkedPatient = patient;
    }
  }

  return <PatientRegisterCompleteScreen invite={invite} linkedPatient={linkedPatient} />;
}
