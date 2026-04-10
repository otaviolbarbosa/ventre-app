import CompleteRegistrationScreen from "@/screens/complete-registration-screen";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import Link from "next/link";

type PageProps = { searchParams: Promise<{ riid?: string }> };

export default async function CompleteRegistrationPage({ searchParams }: PageProps) {
  const { riid } = await searchParams;

  if (!riid) {
    return <ErrorState message="Link de convite inválido." />;
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  // biome-ignore lint/suspicious/noExplicitAny: registration_invites pending pnpm db:types regen
  const { data: invite } = await (supabaseAdmin as any)
    .from("registration_invites")
    .select(
      "id, name, email, phone, professional_type, expired_at, completed_at, enterprises(name)",
    )
    .eq("id", riid)
    .maybeSingle();

  if (!invite) {
    return <ErrorState message="Convite não encontrado." />;
  }

  if (invite.completed_at) {
    return (
      <ErrorState
        message="Este convite já foi utilizado."
        hint="Se você já possui uma conta, faça login abaixo."
      />
    );
  }

  if (new Date(invite.expired_at) < new Date()) {
    return (
      <ErrorState
        message="Este convite expirou."
        hint="Entre em contato com a clínica para receber um novo convite."
      />
    );
  }

  return <CompleteRegistrationScreen invite={invite} />;
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
