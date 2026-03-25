import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { UsersScreen } from "@/screens";
import { getEnterpriseUsers } from "@/services/enterprise-users";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const { profile } = await getServerAuth();

  if (!isStaff(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const { professionals, staff } = await getEnterpriseUsers();

  return <UsersScreen professionals={professionals} staff={staff} />;
}
