"use client";

import { addBirthMaternalVitalsAction } from "@/actions/add-birth-maternal-vitals-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { dayjs } from "@/lib/dayjs";
import {
  type BirthMaternalVitalsInput,
  birthMaternalVitalsSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthMaternalVitalsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthMaternalVitalsModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthMaternalVitalsModalProps) {
  const { executeAsync: addVitals, isPending } = useAction(addBirthMaternalVitalsAction);

  const form = useForm<BirthMaternalVitalsInput>({
    resolver: zodResolver(birthMaternalVitalsSchema),
    defaultValues: {
      systolic_bp: undefined,
      diastolic_bp: undefined,
      pulse_bpm: undefined,
      temperature_celsius: undefined,
      ...defaultBirthEventDateTime(),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        systolic_bp: undefined,
        diastolic_bp: undefined,
        pulse_bpm: undefined,
        temperature_celsius: undefined,
        ...defaultBirthEventDateTime(),
      });
    }
  }, [open, form]);

  async function onSubmit(values: BirthMaternalVitalsInput) {
    const result = await addVitals({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Vitais maternos registrados!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou vitais maternos há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Vitais Maternos"
      description="Preencha os campos que foram medidos"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="systolic_bp"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>PA sistólica (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diastolic_bp"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>PA diastólica (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="pulse_bpm"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Pulso (bpm)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="temperature_celsius"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Temperatura (°C)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" min="0" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
