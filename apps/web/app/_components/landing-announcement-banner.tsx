import Link from "next/link";

export function LandingAnnouncementBanner() {
  return (
    <div className="gradient-primary flex flex-wrap items-center justify-center gap-2.5 px-6 py-2.5 text-center text-white text-[13.5px]">
      <span className="opacity-80">Novidade</span>
      <span className="hidden h-3.5 w-px bg-white/35 sm:block" />
      <span>
        Contratos com assinatura digital e página pública de verificação já estão no ar
      </span>
      <Link href="/#contratos-1a" className="font-semibold text-white underline underline-offset-2">
        Ver como funciona
      </Link>
    </div>
  );
}
