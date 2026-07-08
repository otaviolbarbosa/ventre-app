"use client";

import { useAuth } from "@/hooks/use-auth";
import { EditProfileModal } from "@/modals/edit-profile-modal";
import type { ProfessionalType } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import type { Tables } from "@ventre/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Button } from "@ventre/ui/button";
import { Separator } from "@ventre/ui/separator";
import {
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  FileText,
  Info,
  Loader2,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Profile = Tables<"users">;

type Address = {
  zipcode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

type ProfileScreenProps = {
  profile: Profile;
  address?: Address | null;
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

export default function ProfileScreen({ profile, address }: ProfileScreenProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(profile.name || "");
  const [profilePhone, setProfilePhone] = useState(profile.phone || "");

  const handleLogout = async () => {
    await signOut();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer upload");
      }

      setAvatarUrl(data.avatar_url);
      router.refresh();
    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-center px-4 py-8">
      {/* Avatar */}
      <div className="relative">
        <div className="rounded-full border-2 border-primary p-1">
          <Avatar className="h-28 w-28">
            <AvatarImage
              src={avatarUrl || undefined}
              alt={profile.name || ""}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary/10 text-2xl text-primary">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="icon"
          className="gradient-primary absolute right-0 bottom-0 h-9 w-9 rounded-full shadow-md"
          onClick={handleAvatarClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Name and Email */}
      <h1 className="mt-4 font-bold text-xl">{profileName}</h1>
      <p className="text-muted-foreground">{profile.email}</p>
      <p className="font-semibold text-foreground">
        {professionalTypeLabels[profile.professional_type as ProfessionalType]}
      </p>

      {/* Edit Profile Button */}
      <Button
        className="gradient-primary mt-6 rounded-full px-8"
        onClick={() => setIsEditModalOpen(true)}
      >
        Editar Perfil
      </Button>

      <EditProfileModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        name={profileName}
        phone={profilePhone}
        address={address}
        onSuccess={(name, phone) => {
          setProfileName(name);
          setProfilePhone(phone);
          router.refresh();
        }}
      />

      {/* Menu Section 1 */}
      <div className="mt-8 w-full">
        <Separator />
        <div className="py-2">
          <MenuItem
            icon={<Settings className="h-5 w-5" />}
            label="Configurações"
            href="/profile/settings"
          />
          <MenuItem
            icon={<FileText className="h-5 w-5" />}
            label="Meu Contrato Pessoal"
            href="/profile/settings/contract"
          />
          <MenuItem
            icon={<CreditCard className="h-5 w-5" />}
            label="Minha Assinatura"
            href="/profile/subscription"
          />
          <MenuItem
            icon={<Bell className="h-5 w-5" />}
            label="Minhas Notificações"
            href="/profile/notifications"
          />
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
