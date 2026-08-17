import { Header } from "@/components/layouts/header";
import AppointmentList from "@/components/patient-area/appointment-list";
import { getMyPatientAppointments } from "@/services/patient-self";

export default async function PatientAgendaPage() {
  const { appointments } = await getMyPatientAppointments();

  return (
    <div>
      <Header title="Agenda" />
      <div className="space-y-4 px-4">
        <AppointmentList appointments={appointments} />
      </div>
    </div>
  );
}
