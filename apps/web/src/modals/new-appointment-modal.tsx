"use client";
import { addAppointmentAction } from "@/actions/add-appointment-action";
import { getPatientsByProfessionalAction } from "@/actions/get-patients-by-professional-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import {
  type CreateAppointmentInput,
  createAppointmentSchema,
} from "@/lib/validations/appointment";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Patient = Tables<"patients">;

type Professional = { id: string; name: string | null };

type NewAppointmentModalProps = {
  patientId?: string;
  patients: Patient[];
  professionals?: Professional[];
  isStaff?: boolean;
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
};
export default function NewAppointmentModal({
  patientId,
  patients,
  professionals = [],
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
      setShowModal(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao criar agendamento");
    },
  });

  const isSubmitting = status === "executing";

  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      patient_id: patientId,
      date: "",
      time: "",
      type: undefined,
      duration: 60,
      location: "",
      notes: "",
    },
  });

  function onSubmit(data: CreateAppointmentInput) {
    execute(data);
  }

  const staffPatients = patientsByProfessionalResult.data?.patients ?? [];
  const patientList = isStaff && selectedProfessionalId ? staffPatients : patients;

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    form.reset({
      patient_id: patientId,
      date: "",
      time: "",
      type: undefined,
      duration: 60,
      location: "",
      notes: "",
    });
  }, []);

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
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
                    <Input type="time" {...field} />
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
                <FormControl>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    {...field}
                    onChange={(e) => field.onChange(Number.parseInt(e.target.value) || undefined)}
                  />
                </FormControl>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
