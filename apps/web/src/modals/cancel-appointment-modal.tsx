"use client";

import { cancelAppointmentAction } from "@/actions/cancel-appointment-action";
import type { AppointmentWithProfessional } from "@/services/patient-self";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const cancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  requestReschedule: z.boolean(),
});

type CancelAppointmentFormData = z.infer<typeof cancelAppointmentSchema>;

type CancelAppointmentModalProps = {
  appointment: AppointmentWithProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export function CancelAppointmentModal({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: CancelAppointmentModalProps) {
  const router = useRouter();
  const { execute, status } = useAction(cancelAppointmentAction, {
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao cancelar agendamento");
    },
  });

  const isSubmitting = status === "executing";

  const form = useForm<CancelAppointmentFormData>({
    resolver: zodResolver(cancelAppointmentSchema),
    defaultValues: { reason: "", requestReschedule: false },
  });

  useEffect(() => {
    if (open) {
      form.reset({ reason: "", requestReschedule: false });
    }
  }, [open, form]);

  function onSubmit(data: CancelAppointmentFormData) {
    if (!appointment) return;
    execute({
      appointmentId: appointment.id,
      reason: data.reason,
      requestReschedule: data.requestReschedule,
    });
  }

  if (!appointment) return null;

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Cancelar agendamento"
      description={`Consulta de ${dayjs(appointment.date).format("DD/MM/YYYY")} às ${appointment.time.slice(0, 5)}`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo do cancelamento (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Conte pra gente o que aconteceu" rows={3} {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requestReschedule"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Quero remarcar essa consulta</FormLabel>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
