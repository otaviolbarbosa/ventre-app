"use client";

import { addBirthMembraneRuptureAction } from "@/actions/add-birth-membrane-rupture-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { dayjs } from "@/lib/dayjs";
import {
  type BirthMembraneRuptureInput,
  birthMembraneRuptureSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthMembraneRuptureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthMembraneRuptureModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthMembraneRuptureModalProps) {
  const { executeAsync: addRupture, isPending } = useAction(addBirthMembraneRuptureAction);

  const form = useForm<BirthMembraneRuptureInput>({
    resolver: zodResolver(birthMembraneRuptureSchema),
    defaultValues: defaultBirthEventDateTime(),
  });

  useEffect(() => {
    if (open) form.reset(defaultBirthEventDateTime());
  }, [open, form]);

  async function onSubmit(values: BirthMembraneRuptureInput) {
    const result = await addRupture({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Bolsa rota registrada!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Bolsa Rota"
      description="Confirme a data e hora do rompimento. Este registro é único por parto."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                      onChange={(date) =>
                        field.onChange(date ? date.toISOString().slice(0, 10) : "")
                      }
                      placeholderText="Selecione a data"
                      hideCalendar
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
                  <FormLabel>Hora *</FormLabel>
                  <FormControl>
                    <TimePicker
                      selected={field.value ? new Date(`1970-01-01T${field.value}:00`) : null}
                      onChange={(date) => field.onChange(date ? dayjs(date).format("HH:mm") : "")}
                      timeIntervals={1}
                      hidePredefinedTimes
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
