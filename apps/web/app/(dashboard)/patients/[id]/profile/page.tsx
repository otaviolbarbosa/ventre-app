"use client";
import { deletePatientAction } from "@/actions/delete-patient-action";
import { getPatientAction } from "@/actions/get-patient-action";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishCareModal } from "@/components/shared/finish-care-modal";
import { LoadingPatientProfile } from "@/components/shared/loading-state";
import PatientDocuments from "@/components/shared/patient-documents";
import PatientEvolution from "@/components/shared/patient-evolution";
import PatientInfo from "@/components/shared/patient-info";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PREGNANCY_DELIVERY_METHOD } from "@/lib/constants";
import { CheckCircle2, SearchX, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const patientId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";

  const { execute: fetchPatient, result, isPending } = useAction(getPatientAction);
  const { executeAsync: deletePatient, isPending: isDeleting } = useAction(deletePatientAction);

  useEffect(() => {
    fetchPatient({ patientId });
  }, [fetchPatient, patientId]);

  const patient = result.data?.patient;

  async function handleDelete() {
    const res = await deletePatient({ patientId });

    if (res?.serverError) {
      toast.error(res.serverError);
      setShowDeleteDialog(false);
      return;
    }

    toast.success("Paciente excluída com sucesso!");
    router.push("/patients");
  }

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
              <PatientInfo
                patient={patient}
                onChange={async () => {
                  fetchPatient({ patientId });
                }}
              />
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

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {patient.has_finished ? (
            <div className="flex flex-col gap-2">
              <Badge variant="success" className="w-fit gap-1.5 px-3 py-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Acompanhamento Finalizado
              </Badge>
              {patient.born_at && (
                <>
                  <p className="text-muted-foreground text-sm">
                    Nascimento:{" "}
                    {new Date(patient.born_at).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Via de parto:{" "}
                    {patient.delivery_method
                      ? PREGNANCY_DELIVERY_METHOD[patient.delivery_method]
                      : "Não informado"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Obs: {patient.observations || "-"}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 sm:w-auto"
                onClick={() => setShowFinishModal(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar Acompanhamento
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Gestante
              </Button>
            </>
          )}
        </div>
      </div>

      <FinishCareModal
        open={showFinishModal}
        onOpenChange={setShowFinishModal}
        patientId={patientId}
        onSuccess={() => fetchPatient({ patientId })}
      />

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
