import { LandingFooter } from "@/components/shared/landing-footer";
import { LandingHeader } from "@/components/shared/landing-header";
import PaywallScreen from "@/screens/paywall-screen";

export default async function PaywallPage() {
  return (
    <>
      <LandingHeader />
      <PaywallScreen />
      <LandingFooter />
    </>
  );
}
