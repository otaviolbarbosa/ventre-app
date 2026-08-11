import ventreLogoWhite from "@/assets/ventre-light.png";
import ventreLogo from "@/assets/ventre.png";
import { Baby, Heart, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const highlights = [
  { icon: Heart, text: "Acompanhamento gestacional completo e personalizado" },
  { icon: Baby, text: "Gestão de equipes multidisciplinares de cuidado" },
  {
    icon: Shield,
    text: "Dados protegidos com os mais altos padrões de segurança",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left: brand panel ─────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-primary-dark lg:flex lg:w-[420px] lg:flex-col lg:justify-between xl:w-[480px]">
        {/* Logo */}
        <div className="relative z-10 p-10">
          <div>
            <Link href="/">
              <Image
                src={ventreLogoWhite}
                alt="logo"
                className="object-contain"
                width={200}
                height={200}
              />
            </Link>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-10 pb-4">
          <p className="font-poppins font-semibold text-2xl text-white leading-snug">
            "O cuidado que cada gestante merece, na palma da sua mão."
          </p>
          <div className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Icon className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-white/80 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 p-10">
          <p className="font-medium text-white/60 text-xs">
            © {new Date().getFullYear()} Ventre. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        {/* Mobile logo */}
        <div className="mb-10 space-y-4 lg:hidden">
          <Image src={ventreLogo} alt="logo" className="object-contain" width={240} height={240} />
        </div>

        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
