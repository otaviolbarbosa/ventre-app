"use client";

import { updateAppointmentAction } from "@/actions/update-appointment-action";
import {
  type UpdateAppointmentInput,
  updateAppointmentSchema,
} from "@/lib/validations/appointment";
import type { AppointmentWithPatient } from "@/services/appointment";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Input } from "@ventre/ui/input";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

type EditAppointmentModalProps = {
  appointment: AppointmentWithPatient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export function EditAppointmentModal({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: EditAppointmentModalProps) {
  const { execute, status } = useAction(updateAppointmentAction, {
    onSuccess: () => {
      toast.success("Agendamento atualizado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao atualizar agendamento");
    },
  });

  const isSubmitting = status === "executing";

  const form = useForm<UpdateAppointmentInput>({
    resolver: zodResolver(updateAppointmentSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        type: appointment.type as UpdateAppointmentInput["type"],
        date: appointment.date,
        time: appointment.time.slice(0, 5),
        duration: appointment.duration ?? 60,
        location: appointment.location ?? "",
        notes: appointment.notes ?? "",
      });
    }
  }, [open, appointment, form]);

  function onSubmit(data: UpdateAppointmentInput) {
    execute({ id: appointment.id, ...data });
  }

  function handleClose() {
    onOpenChange(false);
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={(open) => !open && handleClose()}
      title="Editar Agendamento"
      description={`${appointment.patient?.name ?? "Paciente"}`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      onChange={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
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
                      selected={field.value ? (() => { const d = new Date(); const [h, m] = field.value.split(":"); d.setHours(Number(h), Number(m), 0, 0); return d; })() : null}
                      onChange={(date) => field.onChange(date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "")}
                      placeholderText="Selecione o horário"
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
