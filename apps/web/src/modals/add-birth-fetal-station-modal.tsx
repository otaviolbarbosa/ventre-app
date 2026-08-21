"use client";

import { addBirthFetalStationAction } from "@/actions/add-birth-fetal-station-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { dayjs } from "@/lib/dayjs";
import { type BirthFetalStationInput, birthFetalStationSchema } from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Slider } from "@ventre/ui/slider";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthFetalStationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthFetalStationModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthFetalStationModalProps) {
  const { executeAsync: addStation, isPending } = useAction(addBirthFetalStationAction);

  const form = useForm<BirthFetalStationInput>({
    resolver: zodResolver(birthFetalStationSchema),
    defaultValues: { station_lee: undefined, ...defaultBirthEventDateTime() },
  });

  useEffect(() => {
    if (open) form.reset({ station_lee: undefined, ...defaultBirthEventDateTime() });
  }, [open, form]);

  async function onSubmit(values: BirthFetalStationInput) {
    const result = await addStation({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Altura de apresentação registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou a altura há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Altura de Apresentação (Lee)"
      description="Informe a altura na escala de Lee (-4 a +4)"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="station_lee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Plano de Lee: {field.value !== undefined && field.value > 0 ? "+" : ""}
                  {field.value ?? 0} *
                </FormLabel>
                <FormControl>
                  <Slider
                    min={-4}
                    max={4}
                    step={1}
                    value={[field.value ?? 0]}
                    onValueChange={([value]) => field.onChange(value)}
                  />
                </FormControl>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>-4</span>
                  <span>+4</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

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
