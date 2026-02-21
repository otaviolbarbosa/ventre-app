import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-muted to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="3xl" href="/" />
          <p className="text-muted-foreground">Gestão de saúde para gestantes</p>
        </div>
        {children}
      </div>
    </div>
  );
}
