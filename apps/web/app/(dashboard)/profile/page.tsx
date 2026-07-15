import { Header } from "@/components/layouts/header";
import { getServerAuth } from "@/lib/server-auth";
import ProfileScreen from "@/screens/profile-screen";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const { profile, user } = await getServerAuth();

  if (!profile || !user) {
    redirect("/login");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data: addressData } = await supabaseAdmin
    .from("addresses")
    .select("zipcode, street, number, complement, neighborhood, city, state")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div>
      <Header title="Meu Perfil" back />
      <ProfileScreen profile={profile} address={addressData} />
    </div>
  );
}
