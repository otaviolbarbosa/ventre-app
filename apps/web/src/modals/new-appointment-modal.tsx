"use client";
import { addAppointmentAction } from "@/actions/add-appointment-action";
import { getPatientsByProfessionalAction } from "@/actions/get-patients-by-professional-action";
import { cn } from "@/lib/utils";
import {
  type CreateAppointmentInput,
  createAppointmentSchema,
} from "@/lib/validations/appointment";
import type { AppointmentWithPatient } from "@/services/appointment";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ventre/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Textarea } from "@ventre/ui/textarea";
import { ChevronDown, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { type DefaultValues, useForm } from "react-hook-form";
import { toast } from "sonner";

type Patient = Tables<"patients">;

type Professional = { id: string; name: string | null };

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

const defaultValues: DefaultValues<CreateAppointmentInput> = {
  is_external: false,
  patient_id: "",
  date: "",
  time: "",
  type: undefined,
  duration: 60,
  location: "",
  notes: "",
  external_patient_name: "",
  external_patient_phone: "",
  external_patient_email: "",
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
  const [patientSearch, setPatientSearch] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [professionalOpen, setProfessionalOpen] = useState(false);

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

  const isExternal = form.watch("is_external");

  function handleClose() {
    form.reset({ ...defaultValues, patient_id: patientId });
    setSelectedProfessionalId(undefined);
    setPatientSearch("");
    setPatientOpen(false);
    setProfessionalSearch("");
    setProfessionalOpen(false);
    setShowModal(false);
  }

  function onSubmit(data: CreateAppointmentInput) {
    execute(data);
  }

  const staffPatients = patientsByProfessionalResult.data?.patients ?? [];
  const patientList = isStaff && selectedProfessionalId ? staffPatients : patients;
  const filteredPatients =
    patientList?.filter((p) =>
      (p.name ?? "").toLowerCase().includes(patientSearch.toLowerCase()),
    ) ?? [];

  const watchedDate = form.watch("date");
  const watchedTime = form.watch("time");
  const watchedDuration = form.watch("duration");

  const appointmentsRef = useRef(appointments);
  useEffect(() => {
    appointmentsRef.current = appointments;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: appointments kept in ref to avoid infinite loop from new array references on each render
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

    const conflict = appointmentsRef.current.find((a) => {
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
  }, [watchedDate, watchedTime, watchedDuration]);

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
                  <Popover
                    open={professionalOpen}
                    onOpenChange={(open) => {
                      setProfessionalOpen(open);
                      if (!open) setProfessionalSearch("");
                    }}
                  >
                    <FormControl>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-full border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span
                            className={cn(
                              "flex-1 text-left",
                              !field.value ? "text-muted-foreground" : "",
                            )}
                          >
                            {field.value
                              ? (professionals.find((p) => p.id === field.value)?.name ?? field.value)
                              : "Selecione o profissional"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </button>
                      </PopoverTrigger>
                    </FormControl>
                    <PopoverContent
                      className="p-0"
                      align="start"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <div className="border-b p-2">
                        <Input
                          placeholder="Buscar profissional..."
                          value={professionalSearch}
                          onChange={(e) => setProfessionalSearch(e.target.value)}
                          className="h-8 rounded-full"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
                        {professionals.filter((p) =>
                          (p.name ?? "").toLowerCase().includes(professionalSearch.toLowerCase()),
                        ).length === 0 ? (
                          <p className="py-6 text-center text-muted-foreground text-sm">
                            Nenhum profissional encontrado
                          </p>
                        ) : (
                          professionals
                            .filter((p) =>
                              (p.name ?? "").toLowerCase().includes(professionalSearch.toLowerCase()),
                            )
                            .map((prof) => (
                              <button
                                key={prof.id}
                                type="button"
                                className="flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                  field.onChange(prof.id);
                                  setSelectedProfessionalId(prof.id);
                                  form.setValue("patient_id", "");
                                  setPatientSearch("");
                                  fetchPatientsByProfessional({ professionalId: prof.id });
                                  setProfessionalOpen(false);
                                  setProfessionalSearch("");
                                }}
                              >
                                {prof.name ?? prof.id}
                              </button>
                            ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!patientId && (
            <>
              <FormField
                control={form.control}
                name="is_external"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          form.setValue("patient_id", "");
                          form.setValue("external_patient_name", "");
                          form.setValue("external_patient_phone", "");
                          form.setValue("external_patient_email", "");
                          form.clearErrors(["patient_id", "external_patient_name"]);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      Paciente externa (não cadastrada)
                    </FormLabel>
                  </FormItem>
                )}
              />

              {isExternal ? (
                <>
                  <FormField
                    control={form.control}
                    name="external_patient_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da paciente</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="external_patient_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone (opcional)</FormLabel>
                          <FormControl>
                            <InputMask
                              component={Input}
                              placeholder="(00) 00000-0000"
                              mask="(__) _____-____"
                              replacement={{ _: /\d/ }}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="external_patient_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail (opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemplo.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente</FormLabel>
                      <Popover
                        open={patientOpen}
                        onOpenChange={(open) => {
                          setPatientOpen(open);
                          if (!open) setPatientSearch("");
                        }}
                      >
                        <FormControl>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={isStaff && (!selectedProfessionalId || isLoadingPatients)}
                              className="flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-full border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isLoadingPatients ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              <span
                                className={cn(
                                  "flex-1 text-left",
                                  !field.value ? "text-muted-foreground" : "",
                                )}
                              >
                                {isLoadingPatients
                                  ? "Carregando pacientes..."
                                  : field.value
                                    ? (patientList.find((p) => p.id === field.value)?.name ??
                                      field.value)
                                    : isStaff && !selectedProfessionalId
                                      ? "Selecione o profissional primeiro"
                                      : "Selecione a paciente"}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </button>
                          </PopoverTrigger>
                        </FormControl>
                        <PopoverContent
                          className="p-0"
                          align="start"
                          style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                          <div className="border-b p-2">
                            <Input
                              placeholder="Buscar paciente..."
                              value={patientSearch}
                              onChange={(e) => setPatientSearch(e.target.value)}
                              className="h-8 rounded-full"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            {filteredPatients.length === 0 ? (
                              <p className="py-6 text-center text-muted-foreground text-sm">
                                Nenhuma paciente encontrada
                              </p>
                            ) : (
                              filteredPatients.map((patient) => (
                                <button
                                  key={patient.id}
                                  type="button"
                                  className="flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                  onClick={() => {
                                    field.onChange(patient.id);
                                    setPatientOpen(false);
                                    setPatientSearch("");
                                  }}
                                >
                                  {patient.name}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
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
                    <DatePicker
                      selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                      onChange={(date) =>
                        field.onChange(date ? date.toISOString().slice(0, 10) : "")
                      }
                      placeholderText="Selecione a data"
                    />
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
                    <TimePicker
                      selected={
                        field.value
                          ? (() => {
                              const d = new Date();
                              const [h, m] = field.value.split(":");
                              d.setHours(Number(h), Number(m), 0, 0);
                              return d;
                            })()
                          : null
                      }
                      onChange={(date) =>
                        field.onChange(
                          date
                            ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
                            : "",
                        )
                      }
                      placeholderText="Selecione o horário"
                      minTime={new Date(new Date().setHours(6, 0, 0, 0))}
                      maxTime={new Date(new Date().setHours(22, 0, 0, 0))}
                    />
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
