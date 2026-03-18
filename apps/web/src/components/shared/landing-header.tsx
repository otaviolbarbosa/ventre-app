import { LandingHeaderClient } from "@/components/shared/landing-header-client";
import { getServerUser } from "@/lib/server-auth";

export async function LandingHeader() {
  const { user } = await getServerUser();
  return <LandingHeaderClient userId={user?.id} />;
}
