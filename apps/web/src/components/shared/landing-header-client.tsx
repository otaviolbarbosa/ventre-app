"use client";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const navLinks = [
  { label: "Funcionalidades", href: "/#features" },
  { label: "Como funciona", href: "/#how-it-works" },
  { label: "Planos", href: "/paywall" },
];

type Props = {
  userId?: string;
};

export function LandingHeaderClient({ userId }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b transition-all duration-300",
          scrolled || menuOpen
            ? "border-border/40 bg-background/90 shadow-sm backdrop-blur-lg"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Logo href="/" size="xl" />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-foreground/60 text-sm transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden items-center gap-2 md:flex">
            {userId ? (
              <Link href="/home">
                <Button className="gradient-primary gap-2 shadow-soft">
                  Acessar Painel <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button className="text-foreground/60 hover:text-foreground" variant="ghost">
                    Entrar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="gradient-primary shadow-soft">Cadastrar grátis</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-none hover:text-foreground md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile backdrop */}
      {menuOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
        <div
          className="fixed inset-0 top-16 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-16 right-0 left-0 z-50 border-b bg-background shadow-lg transition-all duration-200 md:hidden",
          menuOpen ? "translate-y-0 opacity-100" : "-translate-y-2 pointer-events-none opacity-0",
        )}
      >
        <div className="container mx-auto px-6 py-4">
          <nav className="flex flex-col gap-1">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 font-medium text-foreground/70 text-sm transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="my-3 h-px bg-border" />

          <div className="flex flex-col gap-2 pb-2">
            {userId ? (
              <Link href="/home" onClick={() => setMenuOpen(false)}>
                <Button className="gradient-primary w-full gap-2">
                  Acessar Painel <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full" variant="outline">
                    Entrar
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)}>
                  <Button className="gradient-primary w-full">Cadastrar grátis</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
