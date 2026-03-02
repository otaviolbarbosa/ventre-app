import { LandingHeaderClient } from "@/components/shared/landing-header-client";
import { getCurrentUser } from "@/services";

export async function LandingHeader() {
  const { user } = await getCurrentUser();
  return <LandingHeaderClient userId={user?.id} />;
}
