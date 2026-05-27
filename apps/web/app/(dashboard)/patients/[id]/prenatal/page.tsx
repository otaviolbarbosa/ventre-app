"use client";
import { getPatientAction } from "@/actions/get-patient-action";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPatientProfile } from "@/components/shared/loading-state";
import PrenatalCard from "@/components/shared/prenatal-card";
import { useAuth } from "@/hooks/use-auth";
import { SearchX } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function PatientPrenatalPage() {
  const params = useParams();
  const { isObstetrician, isNurse } = useAuth();

  const patientId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";

  const { execute: fetchPatient, result, isPending } = useAction(getPatientAction);

  useEffect(() => {
    fetchPatient({ patientId });
  }, [fetchPatient, patientId]);

  const patient = result.data?.patient;
  const pregnancy = result.data?.pregnancy;

  if (isPending && !patient) {
    return <LoadingPatientProfile />;
  }

  if (!patient) {
    return (
      <EmptyState
        icon={SearchX}
        title="Paciente não encontrada"
        description="A paciente solicitada não foi encontrada ou você não tem permissão para visualizá-la."
      />
    );
  }

  return (
    <PrenatalCard
      patientId={patient.id}
      pregnancyId={pregnancy?.id}
      isEditable={isObstetrician || isNurse}
    />
  );
}
