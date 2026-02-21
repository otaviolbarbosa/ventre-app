"use client";
import { Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/shared/confirm-modal";
import { LoadingCard } from "@/components/shared/loading-state";
import PatientDocuments from "@/components/shared/patient-documents";
import PatientEvolution from "@/components/shared/patient-evolution";
import PatientInfo from "@/components/shared/patient-info";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { Tables } from "@nascere/supabase/types";

type Patient = Tables<"patients">;

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const patientId = params.id as string;

  async function fetchPatient() {
    const response = await fetch(`/api/patients/${patientId}`);
    const data = await response.json();
    if (data.patient) {
      setPatient(data.patient);
    }
    setLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir paciente");
      }

      toast.success("Paciente excluída com sucesso!");
      router.push("/patients");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir paciente");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return <LoadingCard />;
  }

  if (!patient) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="informacoes">
            <AccordionTrigger className="font-semibold text-base">
              <div className="flex w-full items-center justify-between pr-4">
                <span>Informações da Paciente</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="relative space-y-4 pt-4">
              <PatientInfo patient={patient} onChange={fetchPatient} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cartao-prenatal">
            <AccordionTrigger className="font-semibold text-base">
              Cartão Pré-natal
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">Em breve...</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="documentos">
            <AccordionTrigger className="font-semibold text-base">Documentos</AccordionTrigger>
            <AccordionContent>
              <PatientDocuments patientId={patient.id} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="evolucao">
            <AccordionTrigger className="font-semibold text-base">
              Evolução da Paciente
            </AccordionTrigger>
            <AccordionContent>
              <PatientEvolution patientId={patient.id} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button
          variant="destructive"
          className="w-full sm:w-auto"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir Gestante
        </Button>
      </div>

      <ConfirmModal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Excluir paciente"
        description="Tem certeza que deseja excluir esta paciente? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos."
        confirmLabel="Excluir"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
