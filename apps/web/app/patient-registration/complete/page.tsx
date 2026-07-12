import PatientRegisterCompleteScreen from "@/screens/patient-register-complete-screen";
import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ piid?: string }> };

export default async function PatientRegistrationCompletePage({ searchParams }: PageProps) {
  const { piid } = await searchParams;
  const { user, profile } = await getServerAuth();

  if (!user) {
    redirect("/login");
  }

  if (!piid || profile?.user_type !== "patient") {
    redirect("/home");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite } = await supabaseAdmin
    .from("patient_invite_links")
    .select("id, invite_type, name, email, phone, patient_id, expires_at, used_at")
    .eq("id", piid)
    .maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
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
