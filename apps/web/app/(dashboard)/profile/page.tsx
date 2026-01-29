import { Header } from "@/components/layouts/header";
import ProfileScreen from "@/screens/profile-screen";
import { getProfile } from "@/services/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const { profile, error } = await getProfile();

  if (error || !profile) {
    redirect("/login");
  }

  return (
    <div>
      <Header title="Meu Perfil" back />
      <ProfileScreen profile={profile} />
    </div>
  );
}
