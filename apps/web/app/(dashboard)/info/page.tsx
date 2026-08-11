import { Header } from "@/components/layouts/header";
import InfoScreen from "@/screens/info-screen";

export default function InfoPage() {
  return (
    <div>
      <Header title="Informações" back />
      <InfoScreen />
    </div>
  );
}
