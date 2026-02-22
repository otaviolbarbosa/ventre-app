import { SelectTypeScreen } from "@/screens";
import { getProfile } from "@/services";
import { redirect } from "next/navigation";

export default async function SelectType() {
  const { profile } = await getProfile();

  if (profile?.professional_type) {
    redirect("/home");
  }

  return <SelectTypeScreen />;
}
