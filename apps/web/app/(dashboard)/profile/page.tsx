import { Header } from "@/components/layouts/header";
import { getServerAuth } from "@/lib/server-auth";
import ProfileScreen from "@/screens/profile-screen";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const { profile } = await getServerAuth();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div>
      <Header title="Meu Perfil" back />
      <ProfileScreen profile={profile} />
    </div>
  );
}
