"use client";
import { activateBirthModeAction } from "@/actions/activate-birth-mode-action";
import { deletePregnancyAction } from "@/actions/delete-pregnancy-action";
import { getPatientAction } from "@/actions/get-patient-action";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishCareModal } from "@/components/shared/finish-care-modal";
import { LoadingPatientProfile } from "@/components/shared/loading-state";
import PatientContract from "@/components/shared/patient-contract";
import PatientDocuments from "@/components/shared/patient-documents";
import PatientEvolution from "@/components/shared/patient-evolution";
import PatientInfo from "@/components/shared/patient-info";
import { useAuth } from "@/hooks/use-auth";
import { PREGNANCY_DELIVERY_METHOD } from "@/lib/constants";
import { dayjs } from "@/lib/dayjs";
import InviteExistingPatientModal from "@/modals/invite-existing-patient-modal";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ventre/ui/accordion";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import {
  CalendarPlus,
  CheckCircle2,
  HeartHandshake,
  HeartPulse,
  SearchX,
  Trash2,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showInvitePatientModal, setShowInvitePatientModal] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const { confirm } = useConfirmModal();
  const { isObstetrician, isNurse, isDoula } = useAuth();
  const patientId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";

  const { execute: fetchPatient, result, isPending } = useAction(getPatientAction);
  const { executeAsync: deletePregnancy } = useAction(deletePregnancyAction);
  const { executeAsync: activateBirthMode, isPending: isActivatingBirthMode } =
    useAction(activateBirthModeAction);

  useEffect(() => {
    fetchPatient({ patientId });
  }, [fetchPatient, patientId]);

  const patient = result.data?.patient;
  const pregnancy = result.data?.pregnancy;

  function handleActivateBirthMode(pregnancyId: string) {
    confirm({
      title: "Ativar Modo Parto",
      description:
        "Isso enviará uma notificação por WhatsApp para toda a equipe de cuidado da gestante. Confirma a ativação?",
      confirmLabel: "Ativar",
      onConfirm: async () => {
        const res = await activateBirthMode({ pregnancyId });
        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }
        toast.success("Modo Parto ativado!");
        router.push(`/modo-parto?pregnancyId=${pregnancyId}`);
      },
    });
  }

  function handleConfirmDelete() {
    confirm({
      title: "Excluir gestante",
      description:
        "Tem certeza que deseja excluir esta paciente? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.",
      confirmLabel: "Excluir",
      variant: "destructive",
      onConfirm: async () => {
        const res = await deletePregnancy({ patientId });
        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }
        toast.success("Paciente excluída com sucesso!");
        router.push("/patients");
      },
    });
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
        <div className="flex justify-end gap-2">
          {!patient.user_id && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setShowInvitePatientModal(true)}
              >
                <HeartHandshake className="mr-2 h-4 w-4" />
                Convidar Gestante
              </Button>
            </div>
          )}

          <div className="flex justify-end">
            <Button className="gradient-primary" onClick={() => setShowNewAppointmentModal(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </div>

          {!patient.has_finished && pregnancy?.id && (isObstetrician || isNurse || isDoula) && (
            <div className="flex justify-end">
              {patient.birth_mode_active ? (
                <Button
                  variant="outline"
                  className="w-full border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                  onClick={() => router.push(`/modo-parto?pregnancyId=${pregnancy.id}`)}
                >
                  <HeartPulse className="mr-2 h-4 w-4" />
                  Abrir Modo Parto
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                  disabled={isActivatingBirthMode}
                  onClick={() => handleActivateBirthMode(pregnancy.id)}
                >
                  <HeartPulse className="mr-2 h-4 w-4" />
                  Modo Parto
                </Button>
              )}
            </div>
          )}
        </div>

        <Accordion type="multiple" className="w-full" defaultValue={["informacoes"]}>
          <AccordionItem value="informacoes">
            <AccordionTrigger className="font-poppins font-semibold text-base">
              Informações da Gestante
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

          <AccordionItem value="documentos">
            <AccordionTrigger className="font-poppins font-semibold text-base">
              Arquivos
            </AccordionTrigger>
            <AccordionContent>
              <PatientDocuments patientId={patient.id} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contrato">
            <AccordionTrigger className="font-poppins font-semibold text-base">
              Contrato
            </AccordionTrigger>
            <AccordionContent>
              <PatientContract patientId={patient.id} pregnancyId={pregnancy?.id ?? null} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="evolucao">
            <AccordionTrigger className="font-poppins font-semibold text-base">
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
                    Nascimento: {dayjs(patient.born_at).format("DD/MM/YYYY")}
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
                onClick={handleConfirmDelete}
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

      <InviteExistingPatientModal
        patient={patient}
        isOpen={showInvitePatientModal}
        setIsOpen={setShowInvitePatientModal}
      />
      <NewAppointmentModal
        patientId={patientId}
        patients={[]}
        showModal={showNewAppointmentModal}
        setShowModal={setShowNewAppointmentModal}
      />
    </>
  );
}
