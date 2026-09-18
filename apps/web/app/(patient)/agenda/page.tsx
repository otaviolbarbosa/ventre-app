import { Header } from "@/components/layouts/header";
import { PatientAgendaClient } from "@/components/patient-area/patient-agenda-client";
import { getMyPatientAppointments } from "@/services/patient-self";

export default async function PatientAgendaPage() {
  const { appointments } = await getMyPatientAppointments();

  return (
    <div>
      <Header title="Agenda" />
      <div className="space-y-4 px-4">
        <PatientAgendaClient appointments={appointments} />
      </div>
    </div>
  );
}
