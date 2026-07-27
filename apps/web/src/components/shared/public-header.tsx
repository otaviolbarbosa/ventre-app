import { PublicHeaderClient } from "@/components/shared/public-header-client";
import { getServerUser } from "@/lib/server-auth";

export async function PublicHeader() {
  const { user } = await getServerUser();
  return <PublicHeaderClient userId={user?.id} />;
}
