import { EmptyState } from "@/components/shared/empty-state";
import PrenatalCard from "@/components/shared/prenatal-card";
import { getMyPregnancy } from "@/services/patient-self";
import { Heart } from "lucide-react";

export default async function PatientPrenatalCardPage() {
  const { patient, pregnancy } = await getMyPregnancy();

  if (!patient) {
    return (
      <EmptyState
        icon={Heart}
        title="Cartão pré-natal indisponível"
        description="Não encontramos uma ficha de paciente vinculada à sua conta."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl text-[#433831]">Cartão pré-natal</h1>
      <PrenatalCard patientId={patient.id} pregnancyId={pregnancy?.id} isEditable={false} />
    </div>
  );
}
