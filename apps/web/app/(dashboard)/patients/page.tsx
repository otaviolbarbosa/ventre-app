import { PatientsScreen } from "@/screens";
import { getMyPatients } from "@/services";

export default async function PatientsPage() {
  const { patients } = await getMyPatients();

  return <PatientsScreen patients={patients} />;
}
