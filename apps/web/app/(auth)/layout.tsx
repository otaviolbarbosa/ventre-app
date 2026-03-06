import loginBg from "@/assets/login-bg.jpg";
import { Baby, Heart, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const highlights = [
  { icon: Heart, text: "Acompanhamento gestacional completo e personalizado" },
  { icon: Baby, text: "Gestão de equipes multidisciplinares de cuidado" },
  { icon: Shield, text: "Dados protegidos com os mais altos padrões de segurança" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left: brand panel ─────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:w-[420px] lg:flex-col lg:justify-between xl:w-[480px]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="absolute inset-0 z-0 h-[560px] md:h-screen">
          <Image
            src={loginBg}
            alt="Imagem de fundo de autenticação"
            className="h-full w-full object-cover"
          />

          {/* Overlay with brand colors */}
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--primary))]/60 via-[hsl(var(--primary))]/80 to-[hsl(var(--chart-4))]" />
        </div>

        {/* Decorative blobs */}
        <div className="-right-24 -top-24 absolute h-80 w-80 rounded-full bg-white/10 blur" />
        <div className="-bottom-16 -left-16 absolute h-64 w-64 rounded-full bg-black/5 blur" />
        <div className="absolute right-8 bottom-1/3 h-40 w-40 rounded-full bg-white/10 blur" />

        {/* Logo */}
        <div className="relative z-10 p-10">
          <div>
            <Link href="/">
              <Image
                src="/logo-white.png"
                alt="logo"
                className="object-conten"
                width={160}
                height={160}
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
          {/* <Logo className="justify-center" href="/" size="2xl" /> */}
          <Image src="/logo.png" alt="logo" className="object-conten" width={160} height={160} />
        </div>

        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
