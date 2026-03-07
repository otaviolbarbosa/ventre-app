import { getSubscriptionAction } from "@/actions/get-subscription-action";
import { Header } from "@/components/layouts/header";
import SubscriptionScreen from "@/screens/subscription-screen";
import { getProfile } from "@/services/auth";
import { redirect } from "next/navigation";

export default async function SubscriptionPage() {
  const { profile, error } = await getProfile();

  if (error || !profile) {
    redirect("/login");
  }

  const result = await getSubscriptionAction({});
  const subscription = result?.data?.subscription ?? null;

  return (
    <div>
      <Header title="Minha Assinatura" back />
      <SubscriptionScreen subscription={subscription} profile={profile} />
    </div>
  );
}
