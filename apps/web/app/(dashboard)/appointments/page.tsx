import { AppointmentsScreen } from "@/screens";
import { getMyAppointments } from "@/services/appointment";

export default async function AppointmentsPage() {
  const { appointments } = await getMyAppointments();

  return <AppointmentsScreen appointments={appointments} />;
}
