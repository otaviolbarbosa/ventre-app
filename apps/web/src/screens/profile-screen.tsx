"use client";

import { ContentModal } from "@/components/shared/content-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import type { Tables } from "@nascere/supabase/types";
import {
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  Info,
  Loader2,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

const editProfileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
});

export default function ProfileScreen({ profile }: ProfileScreenProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(profile.name || "");
  const [profilePhone, setProfilePhone] = useState(profile.phone || "");

  const form = useForm<z.infer<typeof editProfileSchema>>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: profile.name || "",
      phone: profile.phone || "",
    },
  });

  useEffect(() => {
    if (isEditModalOpen) {
      form.reset({
        name: profileName,
        phone: profilePhone,
      });
    }
  }, [isEditModalOpen, profileName, profilePhone, form]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSaveProfile = async (values: z.infer<typeof editProfileSchema>) => {
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar");
      }

      setProfileName(data.profile.name);
      setProfilePhone(data.profile.phone || "");
      setIsEditModalOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Save error:", error);
      alert(error instanceof Error ? error.message : "Erro ao salvar perfil");
    }
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
          className="absolute right-0 bottom-0 h-9 w-9 rounded-full shadow-md"
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

      {/* Edit Profile Button */}
      <Button className="mt-6 rounded-full px-8" onClick={() => setIsEditModalOpen(true)}>
        Editar Perfil
      </Button>

      {/* Edit Profile Modal */}
      <ContentModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title="Editar Perfil"
        description="Atualize suas informações pessoais"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveProfile)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <InputMask
                      mask="(__) _____-____"
                      replacement={{ _: /\d/ }}
                      placeholder="(00) 00000-0000"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditModalOpen(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </ContentModal>

      {/* Menu Section 1 */}
      <div className="mt-8 w-full">
        <Separator />
        <div className="py-2">
          <MenuItem
            icon={<Settings className="h-5 w-5" />}
            label="Configurações"
            href="/settings"
          />
          <MenuItem
            icon={<CreditCard className="h-5 w-5" />}
            label="Minha Assinatura"
            href="/billing"
          />
          <MenuItem
            icon={<Bell className="h-5 w-5" />}
            label="Minhas Notificações"
            href="/notifications"
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
