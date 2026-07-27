import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export function PublicFooter() {
  return (
    <footer className="border-t bg-card py-10">
      <div className="container mx-auto flex flex-col items-center gap-4 px-6 sm:grid sm:grid-cols-3 sm:items-center">
        <Logo href="/" size="xl" />
        <p className="order-last text-muted-foreground text-sm sm:order-none sm:justify-self-center">
          &copy; {new Date().getFullYear()} Ventre. Todos os direitos reservados.
        </p>
        <nav className="flex items-center gap-4 sm:justify-self-end">
          <Link
            href="/terms"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Termos de Uso
          </Link>
          <Link
            href="/policies"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Políticas de Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
