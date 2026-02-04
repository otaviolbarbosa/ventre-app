"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase/types";
import { Calendar, Clock, Loader2, MapPin, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ContentModal } from "@/components/shared/content-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dayjs } from "@/lib/dayjs";
import {
  type CreateAppointmentInput,
  createAppointmentSchema,
} from "@/lib/validations/appointment";
import { professionalTypeLabels } from "@/utils/team";

type Appointment = Tables<"appointments"> & {
  professional: { name: string; professional_type: string } | null;
};

const statusLabels: Record<
  string,
  { label: string; variant: "success" | "secondary" | "destructive" }
> = {
  agendada: { label: "Agendada", variant: "success" },
  realizada: { label: "Realizada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

export default function PatientAppointmentsPage() {
  const params = useParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patientId = params.id as string;

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

  const fetchAppointments = async () => {
    const response = await fetch(`/api/appointments?patient_id=${patientId}`);
    const data = await response.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchAppointments changes on every render
  useEffect(() => {
    fetchAppointments();
  }, [patientId]);

  function handleOpenNewModal() {
    form.reset({
      patient_id: patientId,
      date: "",
      time: "",
      type: undefined,
      duration: 60,
      location: "",
      notes: "",
    });
    setShowNewModal(true);
  }

  async function onSubmit(data: CreateAppointmentInput) {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar agendamento");
      }

      toast.success("Agendamento criado com sucesso!");
      setShowNewModal(false);
      fetchAppointments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar agendamento");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingTable />;
  }

  if (appointments.length === 0) {
    return (
      <>
        <EmptyState
          icon={Calendar}
          title="Nenhum agendamento"
          description="Ainda não há agendamentos para esta paciente."
        >
          <Button onClick={handleOpenNewModal}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        </EmptyState>

        <ContentModal
          open={showNewModal}
          onOpenChange={setShowNewModal}
          title="Novo Agendamento"
          description="Agende uma consulta ou encontro com a paciente"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de agendamento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value) || undefined)
                        }
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
                  onClick={() => setShowNewModal(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Agendamento
                </Button>
              </div>
            </form>
          </Form>
        </ContentModal>
      </>
    );
  }

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Agenda</h2>
          <Button onClick={handleOpenNewModal}>
            <Plus className="h-4 w-4" />
            <span className="ml-2 hidden sm:block">Novo Agendamento</span>
          </Button>
        </div>

        <div className="space-y-3">
          {appointments.map((appointment) => {
            const status = statusLabels[appointment.status] ?? {
              label: appointment.status,
              variant: "default" as const,
            };
            return (
              <Card key={appointment.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex flex-col items-center justify-center rounded-lg bg-primary-50 px-3 py-2 font-poppins text-primary-700 shadow shadow-primary/20">
                    <span className="font-semibold text-2xl">
                      {dayjs(appointment.date).format("DD")}
                    </span>
                    <span className="text-sm uppercase">
                      {dayjs(appointment.date).format("MMM")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium font-poppins">
                        {typeLabels[appointment.type] ?? appointment.type}
                      </h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time.slice(0, 5)}
                        {appointment.duration && ` (${appointment.duration}min)`}
                      </span>
                      {appointment.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {appointment.location}
                        </span>
                      )}
                    </div>
                    {appointment.professional && (
                      <p className="mt-1 text-muted-foreground text-sm">
                        <span className="font-semibold">{appointment.professional.name}</span> -{" "}
                        {professionalTypeLabels[appointment.professional.professional_type]}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <ContentModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        title="Novo Agendamento"
        description="Agende uma consulta ou encontro com a paciente"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de agendamento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                onClick={() => setShowNewModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Agendamento
              </Button>
            </div>
          </form>
        </Form>
      </ContentModal>
    </>
  );
}
