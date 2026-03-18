import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { ProfessionalsScreen } from "@/screens";
import { getEnterpriseProfessionals } from "@/services/professional";
import { redirect } from "next/navigation";

export default async function ProfessionalsPage() {
  const { profile } = await getServerAuth();

  if (!isStaff(profile)) {
    redirect("/home");
  }

  const { professionals, enterpriseToken } = await getEnterpriseProfessionals();

  return (
    <ProfessionalsScreen professionals={professionals} enterpriseToken={enterpriseToken} />
  );
}
