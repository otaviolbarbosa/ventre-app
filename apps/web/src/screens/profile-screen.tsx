"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@nascere/supabase/types";
import { ChevronRight, CreditCard, Info, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = Tables<"users">;

type ProfileScreenProps = {
  profile: Profile;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
};

function MenuItem({ icon, label, href, onClick }: MenuItemProps) {
  const content = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <div
      className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-4 transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfileScreen({ profile }: ProfileScreenProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-col items-center px-4 py-8">
      {/* Avatar */}
      <div className="relative">
        <div className="rounded-full border-2 border-primary p-1">
          <Avatar className="h-28 w-28">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.name || ""} />
            <AvatarFallback className="bg-primary/10 text-2xl text-primary">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Name and Email */}
      <h1 className="mt-4 font-bold text-xl">{profile.name}</h1>
      <p className="text-muted-foreground">{profile.email}</p>

      {/* Edit Profile Button */}
      <Button className="mt-6 rounded-full px-8" asChild>
        <Link href="/profile/edit">Editar Perfil</Link>
      </Button>

      {/* Menu Section 1 */}
      <div className="mt-8 w-full">
        <Separator />
        <div className="py-2">
          <MenuItem
            icon={<Settings className="h-5 w-5" />}
            label="Configurações"
            href="/settings"
          />
          <MenuItem icon={<CreditCard className="h-5 w-5" />} label="Assinatura" href="/billing" />
          <MenuItem icon={<Users className="h-5 w-5" />} label="Gerenciar Usuários" href="/users" />
        </div>

        {/* Menu Section 2 */}
        <Separator />
        <div className="py-2">
          <MenuItem icon={<Info className="size-5" />} label="Informações" href="/info" />
          <MenuItem icon={<LogOut className="size-5" />} label="Sair" onClick={handleLogout} />
        </div>
      </div>
    </div>
  );
}
