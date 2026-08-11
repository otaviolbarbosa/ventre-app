import ventreLogoWhite from "@/assets/ventre-light-tag.png";
import ventreLogo from "@/assets/ventre.png";
import Image from "next/image";
import Link from "next/link";

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
        <div className="relative z-10">
          <Link href="/" className="flex justify-center">
            <Image
              src={ventreLogoWhite}
              alt="logo"
              className="object-contain"
              width={240}
              height={240}
            />
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-10 pb-4">
          <p className="flex flex-col font-poppins font-semibold text-[40px] text-primary-medium leading-tight">
            <span>Tecnologia</span>
            <span>que organiza</span>
            <span>o cuidado.</span>
          </p>
          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <span className="font-lato text-white/80 leading-relaxed">
                O Ventre integra pessoas, informações e cuidado para que você possa estar presente
                onde realmente importa.
              </span>
            </div>
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
