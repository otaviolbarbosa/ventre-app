import { Logo } from "@/components/shared/logo";

export function LandingFooter() {
  return (
    <footer className="border-t bg-card py-10">
      <div className="container mx-auto flex flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
        <Logo href="/" size="xl" />
        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Ventre. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
