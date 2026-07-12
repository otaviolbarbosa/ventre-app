import AppointmentList from "@/components/patient-area/appointment-list";
import { getMyPatientAppointments } from "@/services/patient-self";

export default async function PatientAgendaPage() {
  const { appointments } = await getMyPatientAppointments();

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl text-[#433831]">Agenda</h1>
      <AppointmentList appointments={appointments} />
    </div>
  );
}
