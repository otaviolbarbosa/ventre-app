import PatientRegisterScreen from "@/screens/patient-register-screen";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import Link from "next/link";

type PageProps = { searchParams: Promise<{ piid?: string }> };

export default async function PatientRegistrationPage({ searchParams }: PageProps) {
  const { piid } = await searchParams;

  if (!piid) {
    return <ErrorState message="Link de convite inválido." />;
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: invite } = await supabaseAdmin
    .from("patient_invite_links")
    .select("id, invite_type, name, email, phone, patient_id, expires_at, used_at, metadata")
    .eq("id", piid)
    .maybeSingle();

  if (!invite) {
    return <ErrorState message="Convite não encontrado." />;
  }

  if (invite.used_at) {
    return (
      <ErrorState
        message="Este convite já foi utilizado."
        hint="Se você já possui uma conta, faça login abaixo."
      />
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <ErrorState
        message="Este convite expirou."
        hint="Entre em contato com sua equipe de cuidado para receber um novo convite."
      />
    );
  }

  let linkedPatient: { id: string; name: string; email: string | null; phone: string } | null =
    null;

  if (invite.invite_type === "link_existing") {
    if (!invite.patient_id) {
      return <ErrorState message="Convite inválido." />;
    }

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, name, email, phone, user_id")
      .eq("id", invite.patient_id)
      .maybeSingle();

    if (!patient) {
      return <ErrorState message="Paciente não encontrada." />;
    }

    if (patient.user_id) {
      return (
        <ErrorState
          message="Esta paciente já possui uma conta."
          hint="Se você já possui uma conta, faça login abaixo."
        />
      );
    }

    linkedPatient = {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
    };
  }

  return <PatientRegisterScreen invite={invite} linkedPatient={linkedPatient} />;
}

function ErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFAF5] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <img
          src="https://ventre.app/logo.png"
          alt="Ventre"
          width={120}
          className="mx-auto mb-6 object-contain"
        />
        <p className="font-semibold text-[#433831] text-lg">{message}</p>
        {hint && <p className="mt-2 text-[#81726C] text-sm">{hint}</p>}
        <Link
          href="/login"
          className="mt-6 inline-block text-primary text-sm underline-offset-4 hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
