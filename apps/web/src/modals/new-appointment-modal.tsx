"use client";
import { addAppointmentAction } from "@/actions/add-appointment-action";
import { getPatientsByProfessionalAction } from "@/actions/get-patients-by-professional-action";
import {
  type CreateAppointmentInput,
  createAppointmentSchema,
} from "@/lib/validations/appointment";
import type { AppointmentWithPatient } from "@/services/appointment";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { type DefaultValues, useForm } from "react-hook-form";
import { toast } from "sonner";

type Patient = Tables<"patients">;

type Professional = { id: string; name: string | null };

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

const defaultValues: DefaultValues<CreateAppointmentInput> = {
  patient_id: "",
  date: "",
  time: "",
  type: undefined,
  duration: 60,
  location: "",
  notes: "",
};

type NewAppointmentModalProps = {
  patientId?: string;
  patients: Patient[];
  professionals?: Professional[];
  appointments?: AppointmentWithPatient[];
  isStaff?: boolean;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export default function NewAppointmentModal({
  patientId,
  patients,
  professionals = [],
  appointments = [],
  isStaff = false,
  showModal,
  setShowModal,
  onSuccess,
}: NewAppointmentModalProps) {
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | undefined>();

  const {
    execute: fetchPatientsByProfessional,
    result: patientsByProfessionalResult,
    isPending: isLoadingPatients,
  } = useAction(getPatientsByProfessionalAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar pacientes");
    },
  });

  const { execute, status } = useAction(addAppointmentAction, {
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      onSuccess?.();
      handleClose();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar agendamento");
    },
  });

  const isSubmitting = status === "executing";

  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: { ...defaultValues, patient_id: patientId },
  });

  function handleClose() {
    form.reset({ ...defaultValues, patient_id: patientId });
    setSelectedProfessionalId(undefined);
    setShowModal(false);
  }

  function onSubmit(data: CreateAppointmentInput) {
    execute(data);
  }

  const staffPatients = patientsByProfessionalResult.data?.patients ?? [];
  const patientList = isStaff && selectedProfessionalId ? staffPatients : patients;

  const watchedDate = form.watch("date");
  const watchedTime = form.watch("time");
  const watchedDuration = form.watch("duration");

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to flood dependencies
  useEffect(() => {
    if (!watchedDate || !watchedTime) {
      form.clearErrors("time");
      return;
    }

    function toMinutes(time: string) {
      const parts = time.split(":");
      return Number(parts[0]) * 60 + Number(parts[1]);
    }

    const newStart = toMinutes(watchedTime);
    const newEnd = newStart + (watchedDuration ?? 60);

    const conflict = appointments.find((a) => {
      if (a.date !== watchedDate) return false;
      const existingStart = toMinutes(a.time.slice(0, 5));
      const existingEnd = existingStart + (a.duration ?? 60);
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (conflict) {
      const conflictStart = conflict.time.slice(0, 5);
      const conflictEnd = toMinutes(conflictStart) + (conflict.duration ?? 60);
      const conflictEndTime = `${String(Math.floor(conflictEnd / 60)).padStart(2, "0")}:${String(conflictEnd % 60).padStart(2, "0")}`;
      form.setError("time", {
        type: "manual",
        message: `Conflito com agendamento das ${conflictStart} às ${conflictEndTime}`,
      });
    } else {
      form.clearErrors("time");
    }
  }, [watchedDate, watchedTime, watchedDuration, appointments]);

  return (
    <ContentModal
      open={showModal}
      onOpenChange={(open) => !open && handleClose()}
      title="Novo Agendamento"
      description="Agende uma consulta ou encontro com a paciente"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {isStaff && professionals.length > 0 && (
            <FormField
              control={form.control}
              name="professional_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedProfessionalId(value);
                      form.setValue("patient_id", "");
                      fetchPatientsByProfessional({ professionalId: value });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {professionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.name ?? prof.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!patientId && (
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isStaff && (!selectedProfessionalId || isLoadingPatients)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingPatients
                              ? "Carregando pacientes..."
                              : isStaff && !selectedProfessionalId
                                ? "Selecione o profissional primeiro"
                                : "Selecione a paciente"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patientList.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de agendamento</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="encontro">Encontro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário</FormLabel>
                  <FormControl>
                    <Input type="time" step="900" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <Select
                  value={String(field.value ?? 60)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a duração" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DURATION_OPTIONS.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {min} minutos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Endereço ou descrição do local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notas sobre o agendamento" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gradient-primary"
              disabled={isSubmitting || !!form.formState.errors.time}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
