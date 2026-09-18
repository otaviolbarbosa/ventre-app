"use client";

import { confirmAppointmentAttendanceAction } from "@/actions/confirm-appointment-attendance-action";
import type { AppointmentWithProfessional } from "@/services/patient-self";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ConfirmAppointmentModalProps = {
  appointment: AppointmentWithProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export function ConfirmAppointmentModal({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmAppointmentModalProps) {
  const router = useRouter();
  const { execute, status } = useAction(confirmAppointmentAttendanceAction, {
    onSuccess: () => {
      toast.success("Presença confirmada!");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao confirmar presença");
    },
  });

  const isSubmitting = status === "executing";

  if (!appointment) return null;

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirmar presença"
      description={`Consulta de ${dayjs(appointment.date).format("DD/MM/YYYY")} às ${appointment.time.slice(0, 5)}`}
    >
      <p className="text-muted-foreground text-sm">
        Você confirma que vai comparecer a essa consulta?
      </p>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          Voltar
        </Button>
        <Button
          type="button"
          className="gradient-primary"
          disabled={isSubmitting}
          onClick={() => execute({ appointmentId: appointment.id })}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar presença
        </Button>
      </div>
    </ContentModal>
  );
}
