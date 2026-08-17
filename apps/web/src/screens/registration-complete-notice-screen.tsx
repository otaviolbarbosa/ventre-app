import { MailCheck } from "lucide-react";
import Link from "next/link";

export default function RegistrationCompleteNotice({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFAF5] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="https://ventre.app/logo.png"
            alt="Ventre"
            width={120}
            className="mx-auto mb-6 object-contain"
          />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-poppins font-semibold text-2xl text-[#433831]">
            Cadastro concluído!
          </h1>
          <p className="text-[#81726C] text-sm">
            {email ? (
              <>
                Enviamos um e-mail de confirmação para <strong>{email}</strong>. Confirme seu e-mail
                para poder fazer login.
              </>
            ) : (
              "Enviamos um e-mail de confirmação para você. Confirme seu e-mail para poder fazer login."
            )}
          </p>
          <Link
            href="/login"
            className="gradient-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-medium text-sm text-white shadow-soft transition-opacity hover:opacity-90"
          >
            Ir para o login
          </Link>
        </div>

        <p className="mt-6 text-center text-muted-foreground text-xs">
          © {new Date().getFullYear()} Ventre. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
